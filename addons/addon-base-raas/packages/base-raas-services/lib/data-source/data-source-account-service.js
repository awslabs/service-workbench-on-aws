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
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const { generateId } = require('../helpers/utils');
const registerSchema = require('../schema/register-data-source-account');
const updateSchema = require('../schema/update-data-source-account');
const updateStackInfoSchema = require('../schema/update-ds-account-stack-info');
const { toDsAccountEntity, toDbEntity } = require('./helpers/entities/data-source-account-methods');
const { toBucketEntity } = require('./helpers/entities/data-source-bucket-methods');
const { accountIdCompositeKey, bucketIdCompositeKey } = require('./helpers/composite-keys');

const settingKeys = {
  tableName: 'dbDsAccounts',
};

/**
 * This service is responsible for persisting the data source account information.
 * It also orchestrates the steps needed to introduce a study with a status of pendingRegistration.
 */
class DataSourceAccountService extends Service {
  constructor() {
    super();
    this.boom.extend(['notSupported', 400]);
    this.dependency(['aws', 'jsonSchemaValidationService', 'authorizationService', 'dbService', 'auditWriterService']);
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
    // ensure that the caller has permissions to read this account information
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(requestContext, { action: 'read', conditions: [allowIfActive, allowIfAdmin] }, { id });

    const result = await this._getter()
      .key(accountIdCompositeKey.encode({ id }))
      .projection(fields)
      .get();

    return toDsAccountEntity(result);
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`Data source account with id "${id}" does not exist`, true);
    return result;
  }

  async register(requestContext, rawAccountEntity) {
    // Ensure that the caller has permissions to register the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'register', conditions: [allowIfActive, allowIfAdmin] },
      rawAccountEntity,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(rawAccountEntity, registerSchema);

    // TODO - we accept 'mainRegion' but all the acceptable regions are hardcoded in the json schema
    //        so when new regions are introduced, we need to update the json schema

    // unmanaged accounts are not supported yet
    if (rawAccountEntity.type === 'unmanaged')
      throw this.boom.notSupported('Unmanaged accounts are not supported at this time', true);

    // Future enhancement/feature
    // Given the account id, we can search existing member accounts and the main account,
    // if it matches any of these we can determine how the CloudFormation stack can be executed

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { id } = rawAccountEntity;

    // Create a qualifier to use in a few places, such as the cfn stack name and all
    // of the roles created in the data source account. This is needed to avoid collisions
    // with other installations of SWB that also use this data source account.
    const qualifier = `swb-${generateId()}`;
    const stack = `${qualifier}-stack`;

    // Prepare the db object
    const dbObject = toDbEntity(rawAccountEntity, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
      qualifier,
      stack,
      stackCreated: false,
      status: 'pending',
      statusAt: new Date().toISOString(),
    });

    // Time to save the the db object
    const result = toDsAccountEntity(
      await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_not_exists(pk)') // yes we need this
            .key(accountIdCompositeKey.encode(rawAccountEntity))
            .item(dbObject)
            .update();
        },
        async () => {
          throw this.boom.alreadyExists(`account with id "${id}" already registered`, true);
        },
      ),
    );

    // Write audit event
    await this.audit(requestContext, { action: 'register-data-source-account', body: result });

    return result;
  }

  async update(requestContext, rawAccountEntity) {
    // Ensure that the caller has permissions to update the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [allowIfActive, allowIfAdmin] },
      rawAccountEntity,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(rawAccountEntity, updateSchema);

    // For now, we assume that 'updatedBy' is always a user and not a group
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { id, rev } = rawAccountEntity;

    // Prepare the db object
    const dbObject = _.omit(toDbEntity(rawAccountEntity, { updatedBy: by }), ['rev']);

    // Time to save the the db object
    const result = toDsAccountEntity(
      await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_exists(pk) and attribute_exists(sk)') // yes we need this
            .key(accountIdCompositeKey.encode(rawAccountEntity))
            .rev(rev)
            .item(dbObject)
            .update();
        },
        async () => {
          // There are two scenarios here:
          // 1 - The ds account does not exist
          // 2 - The "rev" does not match
          // We will display the appropriate error message accordingly
          const existing = await this.find(requestContext, { id, fields: ['id', 'updatedBy'] });
          if (existing) {
            throw this.boom.outdatedUpdateAttempt(
              `the account information changed just before your request is processed, please try again`,
              true,
            );
          }
          throw this.boom.notFound(`account with id "${id}" does not exist`, true);
        },
      ),
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-data-source-account', body: result });

    return result;
  }

  /**
   * Call this method to update the status of the data source account entity.
   *
   * @param requestContext The standard requestContext
   * @param dsAccountEntity The data source account entity
   * @param status The status to change to. Can be 'pending', 'error' or 'reachable'
   * @param statusMsg The status message to use. Do not provide it if you don't want to
   * change the existing message. Provide an empty string value if you want to clear
   * the existing message. Otherwise, the message you provide will replace the existing
   * message.
   */
  async updateStatus(requestContext, dsAccountEntity, { status, statusMsg } = {}) {
    await this.assertAuthorized(
      requestContext,
      { action: 'update-account', conditions: [allowIfActive, allowIfAdmin] },
      { dsAccountEntity, status, statusMsg },
    );

    if (!_.includes(['pending', 'error', 'reachable'], status)) {
      throw this.boom.badRequest(`A status of '${status}' is not allowed`, true);
    }

    const { id } = dsAccountEntity;
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const removeStatus = status === 'reachable' || _.isEmpty(status);
    const removeMsg = _.isString(statusMsg) && _.isEmpty(statusMsg);

    const item = { updatedBy: by, statusAt: new Date().toISOString() };

    // Remember that we use the 'status' attribute in the index and we need to ensure
    // that when status == reachable that we remove the status attribute from the database
    if (!_.isEmpty(statusMsg)) item.statusMsg = statusMsg;
    if (!removeStatus) item.status = status;

    const dbEntity = await runAndCatch(
      async () => {
        let op = this._updater()
          .condition('attribute_exists(pk) and attribute_exists(sk)')
          .key(accountIdCompositeKey.encode(dsAccountEntity));

        if (removeMsg) op = op.remove('statusMsg');
        if (removeStatus) op = op.names({ '#status': 'status' }).remove('#status');

        return op.item(item).update();
      },
      async () => {
        throw this.boom.notFound(`The data source account entity "${id}" does not exist`, true);
      },
    );

    return toDsAccountEntity(dbEntity);
  }

  async updateStackInfo(requestContext, accountId, stackInfo = {}) {
    await this.assertAuthorized(
      requestContext,
      { action: 'update-account-stack-info', conditions: [allowIfActive, allowIfAdmin] },
      { stackInfo },
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(stackInfo, updateStackInfoSchema);

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const item = { ...stackInfo, updatedBy: by };

    const dbEntity = await runAndCatch(
      async () => {
        const op = this._updater()
          .condition('attribute_exists(pk) and attribute_exists(sk)')
          .key(accountIdCompositeKey.encode({ id: accountId }));

        return op.item(item).update();
      },
      async () => {
        throw this.boom.notFound(`The data source account entity "${accountId}" does not exist`, true);
      },
    );
    return toDsAccountEntity(dbEntity);
  }

  /**
   * Queries the stack at the data source AWS account and returns the following object:
   * { stackId, templateId, templateVer, at }
   *
   * An exception is thrown if an error occurs while trying to describe the stack. This could happen if the stack
   * is not created yet or is not provisioned in the correct account and region or was provisioned but did not
   * use the correct stack name.
   *
   * @param requestContext
   * @param accountEntity
   */
  async queryStack(requestContext, accountEntity) {
    await this.assertAuthorized(
      requestContext,
      { action: 'query-stack', conditions: [allowIfActive, allowIfAdmin] },
      { accountEntity },
    );

    const { id, qualifier, stack: stackName, mainRegion } = accountEntity;
    const roleName = `${qualifier}-app-role-stack`;
    const roleArn = `arn:aws:iam::${id}:role/${roleName}`;
    const cfnApi = await this.getCfnSdk(roleArn, mainRegion);
    const params = { StackName: stackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === stackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${stackName}' not found`, true);
    }

    const stackId = stack.StackId;
    const templateInfoStr = _.get(
      _.find(stack.Outputs, entry => entry.OutputKey === 'swbTemplateInfo'),
      'OutputValue',
    );

    const templateInfo = _.isEmpty(templateInfoStr) ? {} : JSON.parse(templateInfoStr);
    return {
      stackId,
      templateId: templateInfo.templateId,
      templateVer: templateInfo.templateVer,
      at: templateInfo.at,
    };
  }

  async list(requestContext, { fields = [] } = {}) {
    await this.assertAuthorized(requestContext, { action: 'list', conditions: [allowIfActive, allowIfAdmin] });

    // Remember doing a scan is not a good idea if millions of accounts
    const output = await this._scanner()
      .limit(1000)
      .projection(fields)
      .scan();

    // The output array above has a mix entries of accounts and buckets, what we want is to build
    // the result as an array of [ {...accountEntity, buckets = [ bucketEntities] ] }, ...]
    const accountMap = {};
    const isBucketItem = item => _.startsWith(item.sk, bucketIdCompositeKey.skPrefix);
    const getAccountEntry = accountId => {
      const entry = accountMap[`${accountId}`] || { id: accountId, buckets: [] };
      accountMap[`${accountId}`] = entry;
      return entry;
    };

    const result = [];
    _.forEach(output, item => {
      let entry;
      if (isBucketItem(item)) {
        entry = toBucketEntity(item);
        const accountEntry = getAccountEntry(entry.accountId);
        accountEntry.buckets.push(entry);
      } else {
        entry = toDsAccountEntity(item);
        const accountEntry = { ...getAccountEntry(entry.id), ...entry };
        accountMap[`${entry.id}`] = accountEntry;
        result.push(accountEntry);
      }
    });

    return result;
  }

  // @private
  async getCfnSdk(roleArn, region) {
    const aws = await this.service('aws');
    try {
      const cfnClient = await aws.getClientSdkForRole({ roleArn, clientName: 'CloudFormation', options: { region } });
      return cfnClient;
    } catch (error) {
      throw this.boom.forbidden(`Could not assume a role to check the stack status`, true).cause(error);
    }
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'ds-account-authz', action, conditions },
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

module.exports = DataSourceAccountService;
