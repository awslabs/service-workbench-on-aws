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
const { bucketIdCompositeKey } = require('./helpers/composite-keys');
const { toBucketEntity, toDbEntity } = require('./helpers/entities/data-source-bucket-methods');

const settingKeys = {
  tableName: 'dbDsAccounts',
};

/**
 * This service is responsible for persisting the data source bucket entity.
 * NOTE: registering a bucket should be done via DataSourceRegistrationService.registerBucket(),
 * this is because the registration service ensures that the account is registered first before
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
      .key(bucketIdCompositeKey.encode({ accountId, name }))
      .projection(fields)
      .get();

    return toBucketEntity(result);
  }

  async mustFind(requestContext, { accountId, name, fields = [] }) {
    const result = await this.find(requestContext, { accountId, name, fields });
    if (!result) throw this.boom.notFound(`Data source bucket named "${name}" does not exist`, true);
    return result;
  }

  // This method is not expected to be called directly from a controller, if you need to call this from a controller
  // then use the DataSourceAccountService.registerBucket() instead
  async register(requestContext, accountEntity, rawBucketEntity) {
    const rawData = { ...rawBucketEntity, accountId: accountEntity.id };
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

    // TODO - we accept 'region' but all the acceptable regions are hardcoded in the json schema
    //        so when new regions are introduced, we need to update the json schema

    // The only access strategy supported so far is 'roles'
    if (rawBucketEntity.access !== 'roles')
      throw this.boom.notSupported(
        `Bucket access of type "${rawBucketEntity.access}" is not supported at this time`,
        true,
      );

    // kmsArn can only be provide if sse = kms
    if (!_.isEmpty(rawBucketEntity.kmsArn) && rawBucketEntity.sse !== 'kms') {
      throw this.boom.badRequest('KMS arn can only be provided if sse = kms', true);
    }

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { name } = rawData;

    // Prepare the db object
    const dbObject = toDbEntity(rawData, {
      rev: 0,
      createdBy: by,
      updatedBy: by,
    });

    // Time to save the the db object
    const result = toBucketEntity(
      await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_not_exists(pk) and attribute_not_exists(sk)') // yes we need this
            .key(bucketIdCompositeKey.encode(rawData))
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
