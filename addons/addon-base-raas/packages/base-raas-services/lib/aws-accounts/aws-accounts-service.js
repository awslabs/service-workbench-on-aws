/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const uuid = require('uuid/v1');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const { isExternalGuest, isExternalResearcher, isInternalGuest, isInternalResearcher } = require('../helpers/is-role');
const createSchema = require('../schema/create-aws-accounts');
const ensureExternalSchema = require('../schema/ensure-external-aws-accounts');
const updateSchema = require('../schema/update-aws-accounts');

const settingKeys = {
  tableName: 'dbAwsAccounts',
  environmentInstanceFiles: 'environmentInstanceFiles',
  isAppStreamEnabled: 'isAppStreamEnabled',
  swbMainAccount: 'mainAcct',
};

class AwsAccountsService extends Service {
  constructor() {
    super();
    this.dependency([
      'jsonSchemaValidationService',
      'authorizationService',
      'dbService',
      'lockService',
      's3Service',
      'auditWriterService',
      'pluginRegistryService',
      'aws',
    ]);
  }

  async init() {
    await super.init();
    const [dbService] = await this.service(['dbService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);
  }

  async find(requestContext, { id, fields = [] }) {
    const restrict =
      isExternalGuest(requestContext) || isExternalResearcher(requestContext) || isInternalGuest(requestContext);

    if (restrict) return undefined;

    // Future task: add further checks

    const result = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    return this._fromDbToDataObject(result);
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`awsAccounts with id "${id}" does not exist`, true);
    return result;
  }

  async updateEnvironmentInstanceFilesBucketPolicy() {
    const [s3Service, lockService] = await this.service(['s3Service', 'lockService']);
    const environmentInstanceUri = this.settings.get(settingKeys.environmentInstanceFiles);
    const { s3BucketName, s3Key: s3Prefix } = s3Service.parseS3Details(environmentInstanceUri);

    const accountList = await this.list({ fields: ['accountId'] });

    const accountArns = accountList.map(({ accountId }) => `arn:aws:iam::${accountId}:root`);

    // Update S3 bucket policy
    const s3Client = s3Service.api;
    const s3LockKey = `s3|bucket-policy|${s3BucketName}`;
    await lockService.tryWriteLockAndRun({ id: s3LockKey }, async () => {
      const listSid = `List:${s3Prefix}`;
      const getSid = `Get:${s3Prefix}`;

      const securityStatements = [
        {
          Sid: 'Deny requests that do not use TLS',
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Resource: `arn:aws:s3:::${s3BucketName}/*`,
          Condition: { Bool: { 'aws:SecureTransport': false } },
        },
        {
          Sid: 'Deny requests that do not use SigV4',
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Resource: `arn:aws:s3:::${s3BucketName}/*`,
          Condition: {
            StringNotEquals: {
              's3:signatureversion': 'AWS4-HMAC-SHA256',
            },
          },
        },
      ];
      const listStatement = {
        Sid: listSid,
        Effect: 'Allow',
        Principal: { AWS: accountArns },
        Action: 's3:ListBucket',
        Resource: `arn:aws:s3:::${s3BucketName}`,
        Condition: {
          StringLike: {
            's3:prefix': [`${s3Prefix}*`],
          },
        },
      };
      const getStatement = {
        Sid: getSid,
        Effect: 'Allow',
        Principal: { AWS: accountArns },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${s3BucketName}/${s3Prefix}*`],
      };

      const Policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [...securityStatements, listStatement, getStatement],
      });
      return s3Client.putBucketPolicy({ Bucket: s3BucketName, Policy }).promise();
    });
  }

  async create(requestContext, rawData) {
    // ensure that the caller has permissions to create the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'create', conditions: [allowIfActive, allowIfAdmin] },
      rawData,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(rawData, createSchema);

    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const id = uuid();

    // Prepare the db object
    const dbObject = this._fromRawToDbObject(rawData, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
      permissionStatus: rawData.permissionStatus || 'NEEDS_ONBOARD',
    });

    const accountId = rawData.accountId;
    const appStreamImageName = rawData.appStreamImageName;
    if (this.shouldShareAppStreamImageWithMemberAccount(accountId, appStreamImageName)) {
      await this.shareAppStreamImageWithMemberAccount(requestContext, accountId, appStreamImageName);
    }

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // yes we need this
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`awsAccounts with id "${id}" already exists`, true);
      },
    );

    await this.updateEnvironmentInstanceFilesBucketPolicy();

    // Write audit event
    await this.audit(requestContext, { action: 'create-aws-account', body: result });

    return result;
  }

  shouldShareAppStreamImageWithMemberAccount(accountId, appStreamImageName) {
    // Only try to shareAppStreamImage with member account if AppStream is enabled and appStreamImageName is provided
    // and also that the main account ID is not equal to the member account being added
    const mainAccountId = this.settings.get(settingKeys.swbMainAccount);
    return (
      this.settings.getBoolean(settingKeys.isAppStreamEnabled) &&
      appStreamImageName !== undefined &&
      mainAccountId !== accountId
    );
  }

  // We're creating our own private method here instead of using appstream-sc-service because of a circular dependency between
  // aws-account-service and appstream-sc-service
  async shareAppStreamImageWithMemberAccount(requestContext, memberAccountId, appStreamImageName) {
    await this.assertAuthorized(requestContext, {
      action: 'shareAppStreamImageWithMemberAccount',
      conditions: [allowIfActive, allowIfAdmin],
    });
    const aws = await this.service('aws');
    const appStream = await new aws.sdk.AppStream({ apiVersion: '2016-12-01' });
    const params = {
      ImagePermissions: {
        allowFleet: true,
        allowImageBuilder: false,
      },
      Name: appStreamImageName,
      SharedAccountId: memberAccountId,
    };

    await appStream.updateImagePermissions(params).promise();
  }

  async ensureExternalAccount(requestContext, rawData) {
    // TODO: ensure that the caller is an external user
    // await this.assertAuthorized(requestContext, 'create', rawData);

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(rawData, ensureExternalSchema);

    // TODO: setup a GSI and query that for the accountId
    const accounts = await this.list({ fields: ['accountId'] });
    const account = accounts.find(({ accountId }) => accountId === rawData.accountId);
    // If the account has already been added don't add again
    if (account) {
      return account;
    }

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const id = uuid();

    rawData.description = `External account for user ${by}`;

    // Prepare the db object
    const dbObject = this._fromRawToDbObject(rawData, { rev: 0, createdBy: by, updatedBy: by });

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // yes we need this
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`awsAccounts with id "${id}" already exists`, true);
      },
    );

    await this.updateEnvironmentInstanceFilesBucketPolicy();
    return result;
  }

  async checkForActiveNonAppStreamEnvs(requestContext, awsAccountId) {
    if (!this.settings.getBoolean(settingKeys.isAppStreamEnabled)) return;

    const pluginRegistryService = await this.service('pluginRegistryService');
    const activeNonAppStreamEnvs = await pluginRegistryService.visitPlugins(
      'aws-account-mgmt',
      'getActiveNonAppStreamEnvs',
      {
        payload: { requestContext, container: this.container, awsAccountId },
      },
    );

    if (!_.isEmpty(activeNonAppStreamEnvs))
      throw this.boom.badRequest(
        'This account has active non-AppStream environments. Please terminate them and retry this operation',
        true,
      );
  }

  async update(requestContext, rawData) {
    // ensure that the caller has permissions to update the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [allowIfActive, allowIfAdmin] },
      rawData,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(rawData, updateSchema);

    // For now, we assume that 'updatedBy' is always a user and not a group
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { id, rev } = rawData;

    // Verify active Non-AppStream environments do not exist
    await this.checkForActiveNonAppStreamEnvs(requestContext, id);

    const awsAccount = await this.mustFind(requestContext, { id });
    const accountId = awsAccount.accountId;
    const appStreamImageName = rawData.appStreamImageName;
    if (this.shouldShareAppStreamImageWithMemberAccount(accountId, appStreamImageName)) {
      await this.shareAppStreamImageWithMemberAccount(requestContext, accountId, appStreamImageName);
    }

    // Prepare the db object
    const dbObject = _.omit(this._fromRawToDbObject(rawData, { updatedBy: by }), ['rev']);

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .rev(rev)
          .item(dbObject)
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The awsaccounts does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.find(requestContext, { id, fields: ['id', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `awsAccounts information changed just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`awsAccounts with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-aws-account', body: result });

    return result;
  }

  async delete(requestContext, { id }) {
    // ensure that the caller has permissions to delete the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'delete', conditions: [allowIfActive, allowIfAdmin] },
      { id },
    );

    // Lets now remove the item from the database
    const result = await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`awsAccounts with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'delete-aws-account', body: { id } });

    return result;
  }

  async list(requestContext, { fields = [] } = {}) {
    const restrict =
      isExternalGuest(requestContext) ||
      isExternalResearcher(requestContext) ||
      isInternalGuest(requestContext) ||
      isInternalResearcher(requestContext);

    if (restrict) return [];

    // Future task: add further checks

    // Remember doing a scan is not a good idea if you billions of rows
    return this._scanner()
      .limit(1000)
      .projection(fields)
      .scan();
  }

  // Do some properties renaming to prepare the object to be saved in the database
  _fromRawToDbObject(rawObject, overridingProps = {}) {
    const dbObject = { ...rawObject, ...overridingProps };
    return dbObject;
  }

  // Do some properties renaming to restore the object that was saved in the database
  _fromDbToDataObject(rawDb, overridingProps = {}) {
    if (_.isNil(rawDb)) return rawDb; // important, leave this if statement here, otherwise, your update methods won't work correctly
    if (!_.isObject(rawDb)) return rawDb;

    const dataObject = { ...rawDb, ...overridingProps };
    return dataObject;
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'aws-account-authz', action, conditions },
      ...args,
    );
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = AwsAccountsService;
