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
const uuid = require('uuid/v1');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const Service = require('@aws-ee/base-services-container/lib/service');
const { isAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const createSchema = require('../schema/create-egress-store.json');
const {
  getStatementParamsFn,
  listStatementParamsFn,
  putStatementParamsFn,
  updateS3BucketPolicy,
  addAccountToStatement,
  getRevisedS3Statements,
  removeAccountFromStatement,
} = require('../helpers/utils');

const settingKeys = {
  tableName: 'dbEgressStore',
  enableEgressStore: 'enableEgressStore',
  egressStoreBucketName: 'egressStoreBucketName',
  egressStoreKmsKeyAliasArn: 'egressStoreKmsKeyAliasArn',
};

const PROCESSING_STATUS_CODE = 'PROCESSING';
const PROCESSED_STATUS_CODE = 'PROCESSED';
const TERMINATED_STATUS_CODE = 'TERMINATED';
const CREATED_STATUS_CODE = 'CREATED';
class DataEgressService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'dbService',
      'auditWriterService',
      's3Service',
      'lockService',
      'environmentScService',
      'lockService',
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

  async createEgressStore(requestContext, environment) {
    const enableEgressStore = this.settings.get(settingKeys.enableEgressStore);
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

    // prepare info for ddb and update egress store info
    const egressStoreId = uuid();
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
    };
    await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // yes we need this to ensure the environment does not exist already
          .key({ id: egressStoreId })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`Egress Store with id "${egressStoreId}" already exists`, true);
      },
    );

    const kmsArn = await this.getKmsKeyIdArn();
    // Prepare egress store info for updating S3 bucket policy
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
    };
    const memberAccountId = await this.getMemberAccountId(requestContext, environment.id);

    const lockService = await this.service('lockService');
    const lockId = `bucket-policy-access-${bucketName}`;
    await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
      await this.addEgressStoreBucketPolicy(requestContext, egressStore, memberAccountId);
    });

    return egressStore;
  }

  async terminateEgressStore(requestContext, environmentId) {
    const enableEgressStore = this.settings.get(settingKeys.enableEgressStore);
    const curUser = _.get(requestContext, 'principalIdentifier.uid');
    if (!enableEgressStore) {
      throw this.boom.forbidden('Unable to create Egress store since this feature is disabled', true);
    }

    const workspaceId = environmentId;
    let egressStoreScanResult = [];

    try {
      egressStoreScanResult = await this._scanner()
        .limit(1000)
        .scan()
        .then(egressStores => {
          return egressStores.filter(store => store.workspaceId === workspaceId);
        });
    } catch (error) {
      throw this.boom.notFound(`Error in terminating egress store: ${JSON.stringify(error)}`, true);
    }
    const egressStoreInfo = egressStoreScanResult[0];
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
        `Egress store: ${egressStoreInfo.id} is still in processing, workspce can not be terminated before egress request is processed.`,
        true,
      );
    } else if (egressStoreStatus.toUpperCase() === PROCESSED_STATUS_CODE) {
      // ONLY terminate the egress store if it has been processed

      try {
        await s3Service.clearPath(egressStoreInfo.s3BucketName, egressStoreInfo.s3BucketPath);
      } catch (error) {
        throw this.boom.badRequest(
          `Error in deleting egress store:${egressStoreInfo.s3BucketName} in bucket: ${egressStoreInfo.s3BucketPath}`,
          true,
        );
      }
      egressStoreInfo.status = TERMINATED_STATUS_CODE;
      egressStoreInfo.updatedBy = curUser;
      egressStoreInfo.updatedAt = new Date().toISOString();
      await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_exists(id)') // yes we need this to ensure the egress store does not exist already
            .key({ id: egressStoreInfo.id })
            .item(egressStoreInfo)
            .update();
        },
        async () => {
          throw this.boom.badRequest(`Egress Store with id "${egressStoreInfo.id}" got updating error`, true);
        },
      );

      const egressStore = {
        id: `egress-store-${environmentId}`,
        readable: true,
        writeable: true,
        bucket: egressStoreInfo.s3BucketName,
        prefix: egressStoreInfo.s3BucketPath,
        envPermission: {
          read: true,
          write: true,
        },
        status: 'reachable',
        createdBy: egressStoreInfo.createdBy,
        workspaceId: environmentId,
        projectId: egressStoreInfo.projectId,
        resources: [
          {
            arn: `arn:aws:s3:::${egressStoreInfo.s3BucketName}/${environmentId}/`,
          },
        ],
      };

      // Remove egress store related s3 policy from the s3 bucket
      const memberAccountId = await this.getMemberAccountId(requestContext, environmentId);

      const lockService = await this.service('lockService');
      const lockId = `bucket-policy-access-${egressStoreInfo.s3BucketName}`;
      await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
        await this.removeEgressStoreBucketPolicy(requestContext, egressStore, memberAccountId);
      });
      await this.audit(requestContext, { action: 'terminated-egress-store', body: egressStore });
    }
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

  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }

  async getS3() {
    const aws = await this.getAWS();
    return new aws.sdk.S3();
  }

  async getS3BucketAndPolicy() {
    const s3BucketName = this.settings.get(settingKeys.egressStoreBucketName);
    const s3Client = await this.getS3();
    const s3Policy = JSON.parse((await s3Client.getBucketPolicy({ Bucket: s3BucketName }).promise()).Policy);
    if (!s3Policy.Statement) {
      s3Policy.Statement = [];
    }
    return { s3BucketName, s3Policy };
  }

  async addEgressStoreBucketPolicy(requestContext, egressStore, memberAccountId) {
    const { s3BucketName, s3Policy } = await this.getS3BucketAndPolicy();

    const statementParamFunctions = [];
    if (egressStore.envPermission.read) {
      statementParamFunctions.push(getStatementParamsFn);
    }
    if (egressStore.envPermission.write) {
      statementParamFunctions.push(putStatementParamsFn);
    }
    if (egressStore.envPermission.read || egressStore.envPermission.write) {
      statementParamFunctions.push(listStatementParamsFn);
    }
    const revisedStatements = await getRevisedS3Statements(
      s3Policy,
      egressStore,
      s3BucketName,
      statementParamFunctions,
      oldStatement => addAccountToStatement(oldStatement, memberAccountId),
    );

    const s3Client = await this.getS3();

    await updateS3BucketPolicy(s3Client, s3BucketName, s3Policy, revisedStatements);

    // Write audit event
    await this.audit(requestContext, { action: 'add-egress-store-to-bucket-policy', body: s3Policy });
  }

  async removeEgressStoreBucketPolicy(requestContext, egressStore, memberAccountId) {
    const { s3BucketName, s3Policy } = await this.getS3BucketAndPolicy();

    const statementParamFunctions = [getStatementParamsFn, putStatementParamsFn, listStatementParamsFn];
    const revisedStatement = await getRevisedS3Statements(
      s3Policy,
      egressStore,
      s3BucketName,
      statementParamFunctions,
      oldStatement => removeAccountFromStatement(oldStatement, memberAccountId),
    );

    const s3Client = await this.getS3();
    await updateS3BucketPolicy(s3Client, s3BucketName, s3Policy, revisedStatement);

    await this.audit(requestContext, { action: 'remove-egress-store-from-bucket-policy', body: s3Policy });
  }

  async getMemberAccountId(requestContext, environmentId) {
    const environmentScService = await this.service('environmentScService');
    const environmentScEntity = await environmentScService.mustFind(requestContext, { id: environmentId });
    const memberAccount = await environmentScService.getMemberAccount(requestContext, environmentScEntity);
    return memberAccount.accountId;
  }
}

module.exports = DataEgressService;
