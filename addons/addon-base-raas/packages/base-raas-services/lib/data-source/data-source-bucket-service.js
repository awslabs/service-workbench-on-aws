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

const registerSchema = require('../schema/register-data-source-bucket');
const compositeKey = require('../helpers/composite-key');

const settingKeys = {
  tableName: 'dbDsAccounts',
};

// bucketId is an object that helps us encode/decode accountId/bucket name combination so that
// it can be used as a composite key in the table.
const bucketId = compositeKey(
  'ACT#',
  'BUK#',
  obj => ({ pk: obj.accountId, sk: obj.name }),
  (pk, sk) => ({ accountId: pk, name: sk }),
);

/**
 * This service is responsible for persisting the data source bucket information.
 * NOTE: registering a bucket should be done via DataSourceAccountService.registerBucket(),
 * this is because the account service ensures that the account is registered first before
 * a bucket is created.
 */
class DataSourceBucketService extends Service {
  constructor() {
    super();
    this.boom.extend(['notSupported', 400]);
    this.dependency(['jsonSchemaValidationService', 'authorizationService', 'dbService', 'auditWriterService']);
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

  async find(requestContext, { accountId, name, fields = [] }) {
    // ensure that the caller has permissions to read this bucket information
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'read', conditions: [allowIfActive, allowIfAdmin] },
      { accountId, name },
    );

    const result = await this._getter()
      .key(bucketId.encode({ accountId, name }))
      .projection(fields)
      .get();

    return this._fromDbToDataObject(result);
  }

  async mustFind(requestContext, { accountId, name, fields = [] }) {
    const result = await this.find(requestContext, { accountId, name, fields });
    if (!result) throw this.boom.notFound(`Data source bucket named "${name}" does not exist`, true);
    return result;
  }

  // This method is not expected to be called directly from a controller, if you need to call this from a controller
  // then use the DataSourceAccountService.registerBucket() instead
  async register(requestContext, accountEntity, data) {
    const rawData = { ...data, accountId: accountEntity.id };
    // Ensure that the caller has permissions to register the bucket
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'register', conditions: [allowIfActive, allowIfAdmin] },
      rawData,
    );

    // Validate input
    // About the bucket name pattern, see https://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html
    // To allow for registering buckets that were created before March 1, 2018, we need to permit bucket names
    // that are 255 characters long and uppercase letters and underscores
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(rawData, registerSchema);

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { name } = rawData;

    // Prepare the db object
    const dbObject = this._fromRawToDbObject(rawData, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
    });

    // Time to save the the db object
    const result = this._fromDbToDataObject(
      await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_not_exists(pk) and attribute_not_exists(sk)') // yes we need this
            .key(bucketId.encode(rawData))
            .item(dbObject)
            .update();
        },
        async () => {
          throw this.boom.alreadyExists(`bucket "${name}" already registered`, true);
        },
      ),
    );

    // Write audit event
    await this.audit(requestContext, { action: 'register-data-source-bucket', body: result });

    return result;
  }

  // Do some properties renaming to prepare the object to be saved in the database
  _fromRawToDbObject(rawObject, overridingProps = {}) {
    const dbObject = { ...rawObject, ...overridingProps };
    delete dbObject.accountId;
    delete dbObject.name;
    return dbObject;
  }

  // Do some properties renaming to restore the object that was saved in the database
  _fromDbToDataObject(rawDb, overridingProps = {}) {
    if (_.isNil(rawDb)) return rawDb; // important, leave this if statement here, otherwise, your update methods won't work correctly
    if (!_.isObject(rawDb)) return rawDb;

    const dataObject = { ...rawDb, ...overridingProps };
    const { accountId, name } = bucketId.decode(dataObject);
    dataObject.accountId = accountId;
    dataObject.name = name;
    delete dataObject.pk;
    delete dataObject.sk;

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
      { extensionPoint: 'ds-bucket-authz', action, conditions },
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

module.exports = DataSourceBucketService;
