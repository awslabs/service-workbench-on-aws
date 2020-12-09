/* eslint-disable no-await-in-loop */
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
const { sleep, retry } = require('@aws-ee/base-services/lib/helpers/utils');
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const { fsRoleIdCompositeKey } = require('./helpers/composite-keys');
const {
  toDbEntity,
  toFsRoleEntity,
  newFsRoleEntity,
  addMemberAccount,
  hasMemberAccount,
  maxReached,
  toTrustPolicyDoc,
  toInlinePolicyDoc,
  addStudy,
} = require('./helpers/entities/filesystem-role-methods');

const settingKeys = {
  tableName: 'dbRoleAllocations',
  swbMainAccount: 'mainAcct',
};

/**
 * This service is responsible for managing the filesystem role entity.
 */
class FilesystemRoleService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'authorizationService',
      'dbService',
      'auditWriterService',
      'roles-only/applicationRoleService',
      'resourceUsageService',
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

  /**
   * This method returns the filesystem role entity.
   *
   * @param requestContext The standard requestContext
   * @param accountId The data source account id that the filesystem role belongs to
   * @param bucket The name of the bucket
   * @param arn The filesystem role arn
   * @param fields An array of the attribute names to return, default to all the attributes of the filesystem entity
   */
  async find(requestContext, { accountId, bucket, arn, fields = [] }) {
    // Perform default condition checks to make sure the user is active
    await this.assertAuthorized(
      requestContext,
      { action: 'read', conditions: [allowIfActive, allowIfAdmin] },
      { accountId, arn },
    );

    const dbEntity = await this._getter()
      .key(fsRoleIdCompositeKey.encode({ accountId, bucket, arn }))
      .projection(fields)
      .get();

    return toFsRoleEntity(dbEntity);
  }

  /**
   * This method is similar to the 'find' method but it throws an exception if the filesystem role is not found.
   *
   * @param requestContext The standard requestContext
   * @param accountId The data source account id that the filesystem role belongs to
   * @param bucket The name of the bucket
   * @param arn The filesystem role arn
   * @param fields An array of the attribute names to return, default to all the attributes of the
   * filesystem role entity.
   */
  async mustFind(requestContext, { accountId, bucket, arn, fields = [] }) {
    const result = await this.find(requestContext, { accountId, bucket, arn, fields });
    if (!result) throw this.boom.notFound(`Filesystem role with arn "${arn}" does not exist`, true);
    return result;
  }

  /**
   * Call this method to allocate a filesystem role entity for the given study. This method is smart
   * enough to reuse an existing filesystem role entity if there is one already for the same study.
   *
   * Note: this method creates an IAM role resource in an AWS account, if needed.
   *
   * @param requestContext The standard requestContext
   * @param studyEntity The study entity. IMPORTANT, it is expected that this study entity will have
   * an additional property named 'envPermission', it is an object with the following shape:
   * { read: true/false, write: true/false }
   * @param environmentEntity The environment entity that will use the filesystem role
   */
  async allocateRole(requestContext, studyEntity = {}, environmentEntity = {}, memberAccountId) {
    // Allocating a filesystem role is only applicable for bucket with access = 'roles'
    if (studyEntity.bucketAccess !== 'roles') return undefined;

    // Perform default condition checks to make sure the user is active
    await this.assertAuthorized(
      requestContext,
      { action: 'allocate', conditions: [allowIfActive, allowIfAdmin] },
      studyEntity,
    );

    const { id: envId } = environmentEntity;
    const { accountId, id: studyId, bucket, appRoleArn } = studyEntity;
    const studyResource = `roles-only-access-study-${studyId}`;
    const fsUsageSetName = `fs-roles-study-${studyId}`;

    // Primer
    // We capture the relations between four items: fs role, study, member account and environment.
    // We keep the relationship information in three database items across two tables.
    // 1. Study to fs roles, this is a one-to-many relationship (but we need to make it many-to-many in the future
    //    if we introduce storage gateway). This relationship is captured in the ResourceUsages table.
    //    Database item => resource: <studyId>, setName: <studyId>, items: [<fs arn>, ...]
    // 2. Study to member account to environment using the study. This relationship is also captured in the
    //    ResourceUsages table.
    //    Database item => resource: <studyId>, setName: <memberAccountId>, items: [<envId>, ...]
    // 3. fs role to member account ids. This relationship is captured in the RoleAllocations table.
    //    Database item => composite key: <accountId, fs role arn>, trust: [<memberAccountId>, ...]

    // The logic
    // - Get the application role entity from the study.appRoleArn
    // - Using the resource usage service, get all existing usages of fs roles with the study, see item #1 above.
    // - For each found fs role arn, load its fs role entity,
    //   - Does the entity include the member account in its trust, if so, then we don't need to create an fs role
    //   - If not, can we fit the member account in the trust policy, if so then update the actual trust document
    //     in the data source account for the fs role, then update the database, see item #3 above.
    // - If no fs role entity is found, or the existing on has its trust property full, we need to create a new
    //   fs role as follows:
    //   - Create the fs role entity and add the member account to the trust property, see item #3 above.
    //     - At this point, we don't store the entity in the data base until after we are able to create
    //       it in the data source account
    //   - Assume the app role and create the fs role in the data source account
    //   - Store the entity in the database
    //   - Add usage of the study by this role, see item #1 above.

    const [appRoleService, resourceUsageService] = await this.service([
      'roles-only/applicationRoleService',
      'resourceUsageService',
    ]);

    // Get app role entity
    const appRoleEntity = await appRoleService.mustFind(requestContext, { accountId, bucket, arn: appRoleArn });

    // Get all existing usages by fs roles for this study
    const fsRoleUsages = await resourceUsageService.getResourceUsage(requestContext, {
      resource: studyResource,
      setName: fsUsageSetName,
    });
    const fsRoleEntities = _.get(fsRoleUsages, fsUsageSetName, []);

    // Start a loop to see if existing fs roles for the study have the member account already
    // or can take it without exceeding the trust doc limit?
    let fsRoleEntity;

    // eslint-disable-next-line no-restricted-syntax
    for (const fsRoleArn of fsRoleEntities) {
      const entity = await this.find(requestContext, { accountId, bucket, arn: fsRoleArn });
      // eslint-disable-next-line no-continue
      if (!entity) continue;

      if (hasMemberAccount(entity, memberAccountId)) {
        // We found an existing fs role entity that already has the member account
        fsRoleEntity = entity;

        // Add environment usage
        await resourceUsageService.addUsage(requestContext, {
          resource: studyResource,
          setName: memberAccountId,
          item: envId,
        });

        break;
      }

      if (!maxReached(addMemberAccount(entity, memberAccountId))) {
        // We found an existing fs role entity and we can fit the member account in its trust doc

        // Update the fs role policy in the data source account
        await this.updateAssumeRolePolicy(entity);

        // Add environment usage
        await resourceUsageService.addUsage(requestContext, {
          resource: studyResource,
          setName: memberAccountId,
          item: envId,
        });

        // We need to save the fsRoleEntity (even though it is already in the database), because
        // we added the member account id to the trust doc.
        fsRoleEntity = await this.saveEntity(requestContext, entity);
        break;
      }
    }

    // We have one, we are done and we can return it
    if (fsRoleEntity) return fsRoleEntity;

    // Create a new fs role entity
    fsRoleEntity = newFsRoleEntity(appRoleEntity);
    addStudy(fsRoleEntity, studyEntity);
    addMemberAccount(fsRoleEntity, memberAccountId);

    // Create in the fs role in the data source account
    await this.provisionRole(fsRoleEntity);

    // Add environment usage
    await resourceUsageService.addUsage(requestContext, {
      resource: studyResource,
      setName: memberAccountId,
      item: envId,
    });

    // Save entity in database
    fsRoleEntity = await this.saveEntity(requestContext, fsRoleEntity);

    // Add fs role usage
    await resourceUsageService.addUsage(requestContext, {
      resource: studyResource,
      setName: fsUsageSetName,
      item: fsRoleEntity.arn,
    });

    return fsRoleEntity;
  }

  /**
   * Returns a list of all filesystem roles for the given account.
   *
   * @param requestContext The standard requestContext
   * @param accountId The data source account id that the filesystem roles belong to
   * @param bucket To filter by the bucket name (optional)
   * @param fields An array of the attribute names to return, default to all the attributes of
   * the filesystem role entity.
   */
  async list(requestContext, accountId, { bucket, fields = [] } = {}) {
    await this.assertAuthorized(requestContext, { action: 'list', conditions: [allowIfActive, allowIfAdmin] });
    if (_.isEmpty(accountId))
      throw this.boom.badRequest('Listing filesystem roles, requires an account id, and none is provided', true);

    const dbEntities = await this._query()
      .key('pk', fsRoleIdCompositeKey.pk(accountId))
      .sortKey('sk')
      .begins(_.isEmpty(bucket) ? fsRoleIdCompositeKey.skPrefix : `${fsRoleIdCompositeKey.skPrefix}${bucket}#`)
      .limit(1000)
      .projection(fields)
      .query();

    const entities = _.map(dbEntities, toFsRoleEntity);
    return entities;
  }

  // @private
  async saveEntity(requestContext, fsRoleEntity) {
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const dbEntity = await this._updater()
      .key(fsRoleIdCompositeKey.encode(fsRoleEntity))
      .mark(['trust']) // We need to ensure that the 'trust' property is of type set (dynamodb string set)
      .item(toDbEntity(fsRoleEntity, by))
      .update();

    return toFsRoleEntity(dbEntity);
  }

  // @private
  async provisionRole(fsRoleEntity) {
    const { name, boundaryPolicyArn } = fsRoleEntity;
    const iamClient = await this.getIamClient(fsRoleEntity.appRoleArn, _.get(fsRoleEntity.studies, '[0].id', ''));
    const trustPolicyDoc = toTrustPolicyDoc(fsRoleEntity);

    let params = {
      AssumeRolePolicyDocument: JSON.stringify(trustPolicyDoc),
      RoleName: name,
      Description: 'A filesystem role that allows access to studies',
      // 12 hours see
      // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-iam-role.html#cfn-iam-role-maxsessionduration
      MaxSessionDuration: 43200,
      PermissionsBoundary: boundaryPolicyArn,
    };

    // Create the fs role
    await iamClient.createRole(params).promise();

    // Next, we need to add an inline policy that will allow the role to access the appropriate study. However, due to
    // eventual consistency constraints, we can't assume that the role is immediately available. Therefore, we attempt to
    // create the role policy using a retry logic.

    // Lets wait for 0.5 second
    await sleep(500);

    params = {
      PolicyDocument: JSON.stringify(toInlinePolicyDoc(fsRoleEntity)),
      PolicyName: 'StudyS3AccessPolicy',
      RoleName: name,
    };

    const putPolicy = () => {
      return iamClient.putRolePolicy(params).promise();
    };

    // Retry 5 times using an exponential interval
    await retry(putPolicy, 5);
  }

  // @private
  async updateAssumeRolePolicy(fsRoleEntity) {
    const { name } = fsRoleEntity;
    const iamClient = await this.getIamClient(fsRoleEntity.appRoleArn, _.get(fsRoleEntity.studies, '[0].id', ''));
    const trustPolicyDoc = toTrustPolicyDoc(fsRoleEntity);

    const params = {
      PolicyDocument: JSON.stringify(trustPolicyDoc),
      RoleName: name,
    };

    // Create the fs role trust document
    await iamClient.updateAssumeRolePolicy(params).promise();
  }

  // @private
  async getIamClient(appRoleArn, studyId) {
    const aws = await this.service('aws');
    try {
      const iamClient = await aws.getClientSdkForRole({ roleArn: appRoleArn, clientName: 'IAM' });
      return iamClient;
    } catch (error) {
      throw this.boom
        .forbidden(`Could not assume an application role to create a filesystem role for the study '${studyId}'`, true)
        .cause(error);
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
      { extensionPoint: 'filesystem-role-authz', action, conditions },
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

module.exports = FilesystemRoleService;
