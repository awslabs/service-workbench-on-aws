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
const uuid = require('uuid');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const Service = require('@aws-ee/base-services-container/lib/service');
const { isAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const createSchema = require('../schema/create-egress-store.json');
const { StudyPolicy } = require('../helpers/iam/study-policy');

const settingKeys = {
  tableName: 'dbEgressStore',
  enableEgressStore: 'enableEgressStore',
  egressStoreBucketName: 'egressStoreBucketName',
  egressNotificationBucketName: 'egressNotificationBucketName',
  egressStoreKmsKeyAliasArn: 'egressStoreKmsKeyAliasArn',
  egressNotificationSnsTopicArn: 'egressNotificationSnsTopicArn',
};

const PROCESSING_STATUS_CODE = 'PROCESSING';
const PROCESSED_STATUS_CODE = 'PROCESSED';
const TERMINATED_STATUS_CODE = 'TERMINATED';
const CREATED_STATUS_CODE = 'CREATED';
// use pending status code when egress request is send to Data Manager
const PENDING_STATUS_CODE = 'PENDING';
class DataEgressService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'dbService',
      'auditWriterService',
      's3Service',
      'environmentScService',
      'lockService',
      'userService',
    ]);
  }

  async init() {
    await super.init();
    const [dbService] = await this.service(['dbService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);
  }

  async getEgressStoreInfo(environmentId) {
    const workspaceId = environmentId;
    let egressStoreResult;

    try {
      egressStoreResult = await this._getter()
        .key({ id: workspaceId })
        .get();
    } catch (error) {
      throw this.boom.notFound(`Error in fetch egress store info: ${JSON.stringify(error)}`, true);
    }

    if (!egressStoreResult) {
      return null;
    }
    return egressStoreResult;
  }

  async createEgressStore(requestContext, environment) {
    const enableEgressStore = this.settings.getBoolean(settingKeys.enableEgressStore);
    const by = _.get(requestContext, 'principalIdentifier.uid');

    if (!enableEgressStore) {
      throw this.boom.forbidden('Unable to create Egress store since this feature is disabled', true);
    }

    const [validationService, s3Service] = await this.service(['jsonSchemaValidationService', 's3Service']);
    await validationService.ensureValid(environment, createSchema);

    const bucketName = this.settings.get(settingKeys.egressStoreBucketName);
    const folderName = `${environment.id}/`;

    try {
      s3Service.createPath(bucketName, folderName);
    } catch (error) {
      throw this.boom.badRequest(`Error in creating egress store:${folderName} in bucket: ${bucketName}`, true);
    }

    const egressStoreId = environment.id;
    const roleArn = await this.createMainAccountEgressStoreRole(requestContext, egressStoreId);

    // prepare info for ddb and update egress store info
    const creationTime = new Date().toISOString;
    const dbObject = {
      id: egressStoreId,
      egressStoreName: `${environment.name}-egress-store`,
      createdAt: creationTime,
      createdBy: environment.createdBy,
      workspaceId: environment.id,
      projectId: environment.projectId,
      s3BucketName: bucketName,
      s3BucketPath: folderName,
      status: CREATED_STATUS_CODE,
      updatedBy: by,
      updatedAt: creationTime,
      ver: 0,
      isAbleToSubmitEgressRequest: false,
      egressStoreObjectListLocation: null,
      roleArn,
    };

    const lockService = await this.service('lockService');
    const egressStoreDdbLockId = `egress-store-ddb-access-${egressStoreId}`;
    await lockService.tryWriteLockAndRun({ id: egressStoreDdbLockId }, async () => {
      await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_not_exists(id)') // yes we need this to ensure the egress store does not exist already
            .key({ id: egressStoreId })
            .item(dbObject)
            .update();
        },
        async () => {
          throw this.boom.badRequest(`Egress Store with id "${egressStoreId}" already exists`, true);
        },
      );
    });

    const kmsArn = await this.getKmsKeyIdArn();
    // Prepare egress store info for returning status
    const egressStore = {
      id: `egress-store-${environment.id}`,
      readable: true,
      writeable: true,
      kmsArn,
      bucket: bucketName,
      prefix: folderName,
      envPermission: {
        read: true,
        write: true,
      },
      status: 'reachable',
      createdBy: environment.createdBy,
      workspaceId: environment.id,
      projectId: environment.projectId,
      resources: [
        {
          arn: `arn:aws:s3:::${bucketName}/${environment.id}/`,
        },
      ],
      roleArn,
    };

    return egressStore;
  }

  async terminateEgressStore(requestContext, environmentId) {
    const enableEgressStore = this.settings.getBoolean(settingKeys.enableEgressStore);
    const curUser = _.get(requestContext, 'principalIdentifier.uid');
    if (!enableEgressStore) {
      throw this.boom.forbidden('Unable to terminate Egress store since this feature is disabled', true);
    }

    const egressStoreInfo = await this.getEgressStoreInfo(environmentId);
    if (!egressStoreInfo) {
      await this.audit(requestContext, {
        action: 'terminated-egress-store',
        body: 'No egress store found to be terminated',
      });
      return null;
    }
    const isEgressStoreOwner = egressStoreInfo.createdBy === curUser;
    if (!isAdmin(requestContext) && !isEgressStoreOwner) {
      throw this.boom.forbidden(
        `You are not authorized to terminate the egress store. Please contact your administrator.`,
        true,
      );
    }
    const s3Service = await this.service('s3Service');
    const egressStoreStatus = egressStoreInfo.status;

    if (egressStoreStatus.toUpperCase() === PROCESSING_STATUS_CODE) {
      throw this.boom.forbidden(
        `Egress store: ${egressStoreInfo.id} is still in processing. The egress store is not terminated and the workspace can not be terminated before egress request is processed.`,
        true,
      );
    } else if ([PROCESSED_STATUS_CODE, CREATED_STATUS_CODE].includes(egressStoreStatus.toUpperCase())) {
      try {
        await s3Service.clearPath(egressStoreInfo.s3BucketName, egressStoreInfo.s3BucketPath);
      } catch (error) {
        throw this.boom.badRequest(
          `Error in deleting egress store:${egressStoreInfo.s3BucketName} in bucket: ${egressStoreInfo.s3BucketPath}`,
          true,
        );
      }

      const egressStoreDdbLockId = `egress-store-ddb-access-${egressStoreInfo.id}`;
      egressStoreInfo.status = TERMINATED_STATUS_CODE;
      egressStoreInfo.updatedBy = curUser;
      egressStoreInfo.updatedAt = new Date().toISOString();
      egressStoreInfo.isAbleToSubmitEgressRequest = false;
      await this.lockAndUpdate(egressStoreDdbLockId, egressStoreInfo.id, egressStoreInfo);
    }
    return egressStoreInfo;
  }

  async getEgressStore(requestContext, environmentId) {
    const enableEgressStore = this.settings.getBoolean(settingKeys.enableEgressStore);
    if (!enableEgressStore) {
      throw this.boom.forbidden('Unable to list objects in egress store since this feature is disabled', true);
    }
    const curUser = _.get(requestContext, 'principalIdentifier.uid');
    const egressStoreInfo = await this.getEgressStoreInfo(environmentId);
    const isEgressStoreOwner = egressStoreInfo.createdBy === curUser;
    if (!isAdmin(requestContext) && !isEgressStoreOwner) {
      throw this.boom.forbidden(
        `You are not authorized to perform egress store list. Please contact your administrator for more information.`,
        true,
      );
    }
    const s3Service = await this.service('s3Service');
    // always fetch all the objects and sort and return top 100
    const objectList = await s3Service.listAllObjects({
      Bucket: egressStoreInfo.s3BucketName,
      Prefix: egressStoreInfo.s3BucketPath,
    });
    objectList.sort((a, b) => {
      return new Date(a.LastModified) - new Date(b.LastModified);
    });
    let result = [];
    _.forEach(objectList, obj => {
      obj.projectId = egressStoreInfo.projectId;
      obj.workspaceId = egressStoreInfo.workspaceId;
      obj.Size = this.bytesToSize(obj.Size);
      const newKey = obj.Key.split('/');
      if (newKey[1]) {
        obj.Key = newKey[1];
        result.push(obj);
      }
    });
    if (result.length > 100) {
      result = result.slice(0, 100);
    }

    return { objectList: result, isAbleToSubmitEgressRequest: egressStoreInfo.isAbleToSubmitEgressRequest };
  }

  bytesToSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    if (bytes === 0) return '0 Byte';
    let i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10); // parseInt(string, radix) string: The value to parse. radix: An integer between 2 and 36 that represents the radix of the string.
    i = i <= 5 ? i : 5;
    return `${Math.round(bytes / 1024 ** i, 2)} ${sizes[i]}`;
  }

  async prepareEgressStoreSnapshot(egressStoreInfo) {
    const s3Service = await this.service('s3Service');
    const egressNotificationBucketName = this.settings.get(settingKeys.egressNotificationBucketName);
    const curVersion = parseInt(egressStoreInfo.ver, 10) + 1; // parseInt(string, radix) string: The value to parse. radix: An integer between 2 and 36 that represents the radix of the string.
    const key = `${egressStoreInfo.id}/${egressStoreInfo.egressStoreName}-ver${curVersion}.json`;
    try {
      const objectList = await s3Service.listAllObjects({
        Bucket: egressStoreInfo.s3BucketName,
        Prefix: egressStoreInfo.s3BucketPath,
      });
      await Promise.all(
        _.map(objectList, async obj => {
          const latestVersion = await s3Service.getLatestObjectVersion({
            Bucket: egressStoreInfo.s3BucketName,
            Prefix: obj.Key,
          });
          obj.VersionId = latestVersion.VersionId;
          obj.Owner = latestVersion.Owner;
          return obj;
        }),
      );
      const params = {
        Bucket: egressNotificationBucketName,
        Key: key,
        Body: JSON.stringify({ objects: objectList }),
        ContentType: 'application/json',
      };
      await s3Service.putObject(params);
    } catch (error) {
      throw this.boom.badRequest(
        `Error in preparing EgressStoreSnapshot, bucket:${egressNotificationBucketName}, key: ${key}`,
        true,
      );
    }
    return { bucket: egressNotificationBucketName, key };
  }

  async notifySNS(requestContext, environmentId) {
    const enableEgressStore = this.settings.getBoolean(settingKeys.enableEgressStore);
    const curUser = _.get(requestContext, 'principalIdentifier.uid');
    if (!enableEgressStore) {
      throw this.boom.forbidden('Unable to create Egress store since this feature is disabled', true);
    }

    const egressStoreInfo = await this.getEgressStoreInfo(environmentId);
    const isEgressStoreOwner = egressStoreInfo.createdBy === curUser;
    if (!isAdmin(requestContext) && !isEgressStoreOwner) {
      throw this.boom.forbidden(
        `You are not authorized to submit egress request. Please contact your administrator for more information.`,
        true,
      );
    }

    if (!egressStoreInfo.isAbleToSubmitEgressRequest) {
      throw this.boom.badRequest(
        `There are no updates in egress Store:${egressStoreInfo.id} and egress request submission is currently disabled. To submit another egress request, please update egress store objects. For more information, please contact Administrator.`,
        true,
      );
    }
    const egressStoreObjectList = await this.prepareEgressStoreSnapshot(egressStoreInfo);

    // update dynamodb info
    const egressStoreDdbLockId = `egress-store-ddb-access-${egressStoreInfo.id}`;
    if (egressStoreInfo.status.toUpperCase() !== PENDING_STATUS_CODE) {
      egressStoreInfo.status = PENDING_STATUS_CODE;
    }
    egressStoreInfo.updatedBy = curUser;
    egressStoreInfo.updatedAt = new Date().toISOString();
    egressStoreInfo.isAbleToSubmitEgressRequest = false;
    egressStoreInfo.egressStoreObjectListLocation = `arn:aws:s3:::${egressStoreObjectList.bucket}/${egressStoreObjectList.key}`;
    egressStoreInfo.ver = parseInt(egressStoreInfo.ver, 10) + 1; // parseInt(string, radix) string: The value to parse. radix: An integer between 2 and 36 that represents the radix of the string.

    const userService = await this.service('userService');
    const createdByUser = await userService.mustFindUser({ uid: egressStoreInfo.createdBy, fields: 'email' });
    const updatedByUser = await userService.mustFindUser({ uid: egressStoreInfo.updatedBy, fields: 'email' });

    await this.lockAndUpdate(egressStoreDdbLockId, egressStoreInfo.id, egressStoreInfo);

    const message = {
      egress_store_object_list_location: `arn:aws:s3:::${egressStoreObjectList.bucket}/${egressStoreObjectList.key}`,
      id: uuid.v4(),
      egress_store_id: egressStoreInfo.id,
      egress_store_name: egressStoreInfo.egressStoreName,
      created_at: egressStoreInfo.createdAt,
      created_by: egressStoreInfo.createdBy,
      created_by_email: createdByUser.email,
      workspace_id: egressStoreInfo.workspaceId,
      project_id: egressStoreInfo.projectId,
      s3_bucketname: egressStoreInfo.s3BucketName,
      s3_bucketpath: egressStoreInfo.s3BucketPath,
      status: egressStoreInfo.status,
      updated_by: egressStoreInfo.updatedBy,
      updated_by_email: updatedByUser.email,
      updated_at: egressStoreInfo.updatedAt,
      ver: egressStoreInfo.ver,
    };

    // publish the message to SNS
    try {
      await this.publishMessage(JSON.stringify(message));
    } catch (error) {
      throw this.boom.badRequest(`Unable to publish message for egress store: ${egressStoreInfo.id}`, true);
    }

    // Write audit
    await this.audit(requestContext, { action: 'trigger-egress-notification-process', body: message });
    return message;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  // @private
  async getKmsKeyIdArn() {
    // Get the kms key id
    const kmsAliasArn = this.settings.get(settingKeys.egressStoreKmsKeyAliasArn);

    // Get KMS Key ARN from KMS Alias ARN
    // The "Decrypt","DescribeKey","GenerateDataKey" etc require KMS KEY ARN and not ALIAS ARN
    const kmsClient = await this.getKMS();
    const data = await kmsClient
      .describeKey({
        KeyId: kmsAliasArn,
      })
      .promise();
    return data.KeyMetadata.Arn;
  }

  async getKMS() {
    const aws = await this.getAWS();
    return new aws.sdk.KMS();
  }

  async getIAM() {
    const aws = await this.getAWS();
    return new aws.sdk.IAM();
  }

  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }

  async getS3() {
    const aws = await this.getAWS();
    return new aws.sdk.S3();
  }

  async publishMessage(message) {
    const aws = await this.getAWS();
    const snsService = new aws.sdk.SNS();
    const topicArn = this.settings.get(settingKeys.egressNotificationSnsTopicArn);
    const params = { Message: message, TopicArn: topicArn };
    await snsService.publish(params).promise();
  }

  async getMemberAccountId(requestContext, environmentId) {
    const environmentScService = await this.service('environmentScService');
    const environmentScEntity = await environmentScService.mustFind(requestContext, { id: environmentId });
    const memberAccount = await environmentScService.getMemberAccount(requestContext, environmentScEntity);
    return memberAccount.accountId;
  }

  getMainAccountEgressStoreRole(egressStoreId) {
    return `swb-study-${egressStoreId}`;
  }

  getMainAccountEgressStoreRolePolicyName(egressStoreId) {
    return `swb-study-${egressStoreId}`;
  }

  /**
   * Create the main account IAM Role  and Policy to allow a workspace on the member account to access
   * the egress store S3 bucket
   * @param requestContext
   * @param egressStoreId
   * @returns role Arn
   */
  async createMainAccountEgressStoreRole(requestContext, egressStoreId) {
    const egressStoreBucketName = this.settings.get('egressStoreBucketName');
    const kmsArn = await this.getKmsKeyIdArn();
    const memberAccountId = await this.getMemberAccountId(requestContext, egressStoreId);
    const mainAccountRoleName = this.getMainAccountEgressStoreRole(egressStoreId);
    const permissionBoundaryArn = this.settings.get('permissionBoundaryPolicyStudyBucketArn');

    const egressStudyPolicy = new StudyPolicy();

    const study = {
      bucket: egressStoreBucketName,
      folder: [egressStoreId],
      permission: {
        read: true,
        write: true,
      },
      kmsArn,
    };
    egressStudyPolicy.addStudy(study);
    const permissionPolicy = egressStudyPolicy.toPolicyDoc();

    const iam = await this.getIAM();
    const createPolicyResponse = await iam
      .createPolicy({
        PolicyName: this.getMainAccountEgressStoreRolePolicyName(egressStoreId),
        PolicyDocument: JSON.stringify(permissionPolicy),
      })
      .promise();

    const createRoleResponse = await iam
      .createRole({
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                AWS: `arn:aws:iam::${memberAccountId}:root`,
              },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
        Path: '/',
        RoleName: mainAccountRoleName,
        PermissionsBoundary: permissionBoundaryArn,
      })
      .promise();

    await iam
      .attachRolePolicy({
        RoleName: mainAccountRoleName,
        PolicyArn: createPolicyResponse.Policy.Arn,
      })
      .promise();

    return createRoleResponse.Role.Arn;
  }

  async deleteMainAccountEgressStoreRole(egressStoreId) {
    const iam = await this.getIAM();
    const listRolePoliciesResponse = await iam
      .listAttachedRolePolicies({
        RoleName: this.getMainAccountEgressStoreRole(egressStoreId),
      })
      .promise();
    const policyArns = listRolePoliciesResponse.AttachedPolicies.map(policy => {
      return policy.PolicyArn;
    });
    await Promise.all(
      policyArns.map(arn => {
        return iam
          .detachRolePolicy({
            RoleName: this.getMainAccountEgressStoreRole(egressStoreId),
            PolicyArn: arn,
          })
          .promise();
      }),
    );
    await iam.deleteRole({ RoleName: this.getMainAccountEgressStoreRole(egressStoreId) }).promise();
    await Promise.all(
      policyArns.map(arn => {
        return iam.deletePolicy({ PolicyArn: arn }).promise();
      }),
    );
  }

  async lockAndUpdate(lockId, dbKey, dbObject) {
    const lockService = await this.service('lockService');
    await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
      await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_exists(id)') // yes we need this to ensure the egress store does exist already
            .key({ id: dbKey })
            .item(dbObject)
            .update();
        },
        async () => {
          throw this.boom.badRequest(`Egress Store with id "${dbKey}" got updating error`, true);
        },
      );
    });
  }

  async enableEgressStoreSubmission(egressStoreInfo) {
    const egressStoreDdbLockId = `egress-store-ddb-access-${egressStoreInfo.id}`;
    egressStoreInfo.isAbleToSubmitEgressRequest = true;
    await this.lockAndUpdate(egressStoreDdbLockId, egressStoreInfo.id, egressStoreInfo);
  }
}

module.exports = DataEgressService;
