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

const { appRoleIdCompositeKey } = require('./helpers/composite-keys');
const {
  toDbEntity,
  toAppRoleEntity,
  newAppRoleEntity,
  addStudy,
  maxReached,
  toCfnResources,
} = require('./helpers/entities/application-role-methods');

const settingKeys = {
  tableName: 'dbRoleAllocations',
  swbMainAccount: 'mainAcct',
};

/**
 * This service is responsible for managing the application role entity.
 */
class ApplicationRoleService extends Service {
  constructor() {
    super();
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

  /**
   * This method returns the application role entity.
   *
   * @param requestContext The standard requestContext
   * @param accountId The data source account id that the application role belongs to
   * @param bucket The name of the bucket
   * @param arn The application role arn
   * @param fields An array of the attribute names to return, default to all the attributes
   * of the application role entity.
   */
  async find(requestContext, { accountId, bucket, arn, fields = [] }) {
    // Perform default condition checks to make sure the user is active
    await this.assertAuthorized(
      requestContext,
      { action: 'read', conditions: [allowIfActive, allowIfAdmin] },
      { accountId, arn },
    );

    const dbEntity = await this._getter()
      .key(appRoleIdCompositeKey.encode({ accountId, bucket, arn }))
      .projection(fields)
      .get();

    return toAppRoleEntity(dbEntity);
  }

  /**
   * This method is similar to the 'find' method but it throws an exception if the application role
   * is not found.
   *
   * @param requestContext The standard requestContext
   * @param accountId The data source account id that the application role belongs to
   * @param bucket The name of the bucket
   * @param arn The application role arn
   * @param fields An array of the attribute names to return, default to all the attributes
   * of the application role entity.
   */
  async mustFind(requestContext, { accountId, bucket, arn, fields = [] }) {
    const result = await this.find(requestContext, { accountId, bucket, arn, fields });
    if (!result) throw this.boom.notFound(`Application role with arn "${arn}" does not exist`, true);
    return result;
  }

  /**
   * Call this method to allocate an application role entity for the given study. This method is smart
   * enough to reuse an existing app role entity if there is enough space for the study to fit in.
   *
   * Note: this method does NOT actually create an IAM role resource in an AWS account.
   *
   * @param requestContext The standard requestContext
   * @param accountEntity The data source account entity
   * @param bucketEntity The data source bucket entity
   * @param studyEntity The study entity
   */
  async allocateRole(requestContext, accountEntity = {}, bucketEntity = {}, studyEntity = {}) {
    // Allocating an application role is only applicable for bucket with access = 'roles'
    if (studyEntity.bucketAccess !== 'roles') return undefined;

    // Perform default condition checks to make sure the user is active
    await this.assertAuthorized(
      requestContext,
      { action: 'allocate', conditions: [allowIfActive, allowIfAdmin] },
      studyEntity,
    );
    const { accountId, id: studyId, bucket } = studyEntity;

    // The logic
    // - Get all the application roles entities by the account and the bucket
    // - Do we have the study already part of an existing application role?
    //   - if yes, then return the application role
    // - For each application roles, do the following:
    //   - add study to the role entity
    //   - check if size has reached the max
    //    - if not then we found a place for the study and we update the application role
    //      entity and return it
    // - If none is found, create a new application role, add study to it, store it
    //   in the database  and return the application role entity

    const appRoleEntities = await this.list(requestContext, accountId, { bucket });
    let appRoleEntity = _.find(appRoleEntities, entity => _.has(entity, ['studies', studyId]));

    if (!_.isUndefined(appRoleEntity)) return appRoleEntity;

    appRoleEntity = undefined;
    // eslint-disable-next-line consistent-return
    _.forEach(appRoleEntities, entity => {
      if (!maxReached(addStudy(entity, studyEntity))) {
        appRoleEntity = entity;
        return false; // To stop the loop since we found a role
      }
    });

    if (_.isUndefined(appRoleEntity)) {
      appRoleEntity = newAppRoleEntity(accountEntity, bucketEntity, studyEntity);
    }

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const dbEntity = await this._updater()
      .key(appRoleIdCompositeKey.encode(appRoleEntity))
      .item(toDbEntity(appRoleEntity, by))
      .update();

    return toAppRoleEntity(dbEntity);
  }

  /**
   * Call this method to update the status of the application role entity.
   *
   * @param requestContext The standard requestContext
   * @param appRoleEntity The application role entity
   * @param status The status to change to. Can be 'pending', 'error' or 'reachable'
   * @param statusMsg The status message to use. Do not provide it if you don't want to
   * change the existing message. Provide an empty string value if you want to clear
   * the existing message. Otherwise, the message you provide will replace the existing
   * message.
   */
  async updateStatus(requestContext, appRoleEntity, { status, statusMsg } = {}) {
    await this.assertAuthorized(
      requestContext,
      { action: 'update-status', conditions: [allowIfActive, allowIfAdmin] },
      { appRoleEntity, status, statusMsg },
    );

    if (!_.includes(['pending', 'error', 'reachable'], status)) {
      throw this.boom.badRequest(`A status of '${status}' is not allowed`, true);
    }

    const { arn } = appRoleEntity;
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
          .key(appRoleIdCompositeKey.encode(appRoleEntity));

        if (removeMsg) op = op.remove('statusMsg');
        if (removeStatus) op = op.names({ '#status': 'status' }).remove('#status');

        return op.item(item).update();
      },
      async () => {
        throw this.boom.notFound(`The application role entity "${arn}" does not exist`, true);
      },
    );

    return toAppRoleEntity(dbEntity);
  }

  /**
   * Returns a list of all application roles for the given account.
   *
   * @param requestContext The standard requestContext
   * @param accountId The data source account id that the application roles belong to
   * @param bucket To filter by the bucket name (optional)
   * @param fields An array of the attribute names to return, default to all the attributes
   * of the application role entity.
   */
  async list(requestContext, accountId, { bucket, fields = [] } = {}) {
    await this.assertAuthorized(requestContext, { action: 'list', conditions: [allowIfActive, allowIfAdmin] });

    const dbEntities = await this._query()
      .key('pk', appRoleIdCompositeKey.pk(accountId))
      .sortKey('sk')
      .begins(_.isEmpty(bucket) ? appRoleIdCompositeKey.skPrefix : `${appRoleIdCompositeKey.skPrefix}${bucket}#`)
      .limit(1000)
      .projection(fields)
      .query();

    const entities = _.map(dbEntities, toAppRoleEntity);
    return entities;
  }

  /**
   * Using the given cfnTemplate, this method adds cfn resources that represents all the application
   * roles and managed policies (used for boundary permissions) that are to be provisioned or updated in
   * the given account using the mainRegion. Therefore, there are no resources returned for other regions
   *
   * @param requestContext The standard requestContext
   * @param cfnTemplate An instance of The CfnTemplate class
   * @param accountId The data source account id where the application roles will be provisioned
   */
  async provideCfnResources(requestContext, cfnTemplate, accountId) {
    await this.assertAuthorized(requestContext, { action: 'list', conditions: [allowIfActive, allowIfAdmin] });

    // Logic
    // - Get a list of all applications roles for the account
    // - Ask each application role to return its role cfn resource and its managed policy cfn resource

    const swbMainAccountId = this.settings.get(settingKeys.swbMainAccount);
    const list = await this.list(requestContext, accountId);
    _.forEach(list, appRoleEntity => {
      const resources = toCfnResources(appRoleEntity, swbMainAccountId);
      cfnTemplate.addResources(resources);
    });

    return cfnTemplate;
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'application-role-authz', action, conditions },
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

module.exports = ApplicationRoleService;
