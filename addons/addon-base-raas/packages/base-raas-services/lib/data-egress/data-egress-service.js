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
const createSchema = require('../schema/create-egress-store.json');

const settingKeys = {
  tableName: 'dbEgressStore',
  enableEgressStore: 'enableEgressStore',
  egressStoreBucketName: 'egressStoreBucketName',
  egressStoreKmsKeyAliasArn: 'egressStoreKmsKeyAliasArn',
};

const listStatementParamsFn = (bucket, prefix) => {
  return {
    statementId: `List:${prefix}`,
    resource: `arn:aws:s3:::${bucket}`,
    actions: ['s3:ListBucket'],
    condition: {
      StringLike: {
        's3:prefix': [`${prefix}*`],
      },
    },
  };
};

const getStatementParamsFn = (bucket, prefix) => {
  return {
    statementId: `Get:${prefix}`,
    resource: [`arn:aws:s3:::${bucket}/${prefix}*`],
    actions: ['s3:GetObject'],
  };
};

const putStatementParamsFn = (bucket, prefix) => {
  return {
    statementId: `Put:${prefix}`,
    resource: [`arn:aws:s3:::${bucket}/${prefix}*`],
    actions: [
      's3:AbortMultipartUpload',
      's3:ListMultipartUploadParts',
      's3:PutObject',
      's3:PutObjectAcl',
      's3:DeleteObject',
    ],
  };
};

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

    if (!enableEgressStore) {
      throw this.boom.forbidden('Unable to create Egress store since this feature is disabled', true);
    }

    const [validationService, s3Service] = await this.service(['jsonSchemaValidationService', 's3Service']);
    await validationService.ensureValid(environment, createSchema);

    const bucketName = this.settings.get(settingKeys.egressStoreBucketName);
    const folderName = `${environment.id}/`;

    try {
      s3Service.createFolder(bucketName, folderName);
    } catch (errot) {
      throw this.boom.badRequest(`Error in creating egress store:${folderName} in bucket: ${bucketName}`, true);
    }

    // prepare info for ddb and update egress store info
    const egressStoreId = uuid();
    const dbObject = {
      id: egressStoreId,
      egressStoreName: `${environment.name}-egress-store`,
      createdBy: environment.createdBy,
      workspaceId: environment.id,
      projectId: environment.projectId,
      s3BucketName: bucketName,
      s3BucketPath: folderName,
      status: 'Created',
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

    const environmentScService = await this.service('environmentScService');
    const environmentScEntity = await environmentScService.mustFind(requestContext, { id: environment.id });
    const memberAccount = await environmentScService.getMemberAccount(requestContext, environmentScEntity);
    await this.addEgressStoreBucketPolicy(requestContext, egressStore, memberAccount.accountId);

    return egressStore;
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
    const revisedStatements = await this.getRevisedS3Statements(
      s3Policy,
      egressStore,
      s3BucketName,
      statementParamFunctions,
      oldStatement => this.addAccountToStatement(oldStatement, memberAccountId),
    );

    await this.updateS3BucketPolicy(s3BucketName, s3Policy, revisedStatements);

    // Write audit event
    await this.audit(requestContext, { action: 'add-egress-store-bucket-policy', body: s3Policy });
  }

  addAccountToStatement(oldStatement, memberAccountId) {
    const principal = this.getRootArnForAccount(memberAccountId);
    const statement = this.addEmptyPrincipalIfNotPresent(oldStatement);
    if (Array.isArray(statement.Principal.AWS)) {
      // add the principal if it doesn't exist already
      if (!statement.Principal.AWS.includes(principal)) {
        statement.Principal.AWS.push(principal);
      }
    } else if (statement.Principal.AWS !== principal) {
      statement.Principal.AWS = [statement.Principal.AWS, principal];
    }
    return statement;
  }

  // @private
  getRootArnForAccount(memberAccountId) {
    return `arn:aws:iam::${memberAccountId}:root`;
  }

  // @private
  addEmptyPrincipalIfNotPresent(statement) {
    if (!statement.Principal) {
      statement.Principal = {};
    }
    if (!statement.Principal.AWS) {
      statement.Principal.AWS = [];
    }
    return statement;
  }

  // @private
  async getRevisedS3Statements(s3Policy, egressStore, bucket, statementParamFunctions, updateStatementFn) {
    const revisedStatementsPerStudy = _.map(statementParamFunctions, statementParameterFn => {
      const statementParams = statementParameterFn(bucket, egressStore.prefix);
      let oldStatement = s3Policy.Statement.find(statement => statement.Sid === statementParams.statementId);
      if (!oldStatement) {
        oldStatement = this.createAllowStatement(
          statementParams.statementId,
          statementParams.actions,
          statementParams.resource,
          statementParams.condition,
        );
      }
      const newStatement = updateStatementFn(oldStatement);
      return newStatement;
    });
    return revisedStatementsPerStudy;
  }

  // @private
  async updateS3BucketPolicy(s3BucketName, s3Policy, revisedStatements) {
    const s3Client = await this.getS3();

    // remove all the old statements from s3Policy that have changed
    const revisedStatementIds = revisedStatements.flat().map(statement => statement.Sid);
    s3Policy.Statement = s3Policy.Statement.filter(statement => !revisedStatementIds.includes(statement.Sid));

    // add all the revised statements to the s3Policy
    revisedStatements.flat().forEach(statement => {
      // Only add updated statement if it contains principals (otherwise leave it out)
      if (statement.Principal.AWS.length > 0) {
        s3Policy.Statement.push(statement);
      }
    });
    // Update S3 bucket policy
    await s3Client.putBucketPolicy({ Bucket: s3BucketName, Policy: JSON.stringify(s3Policy) }).promise();
  }

  // @private
  createAllowStatement(statementId, actions, resource, condition) {
    const baseAllowStatement = {
      Sid: statementId,
      Effect: 'Allow',
      Principal: { AWS: [] },
      Action: actions,
      Resource: resource,
    };
    if (condition) {
      baseAllowStatement.Condition = condition;
    }
    return baseAllowStatement;
  }
}

module.exports = DataEgressService;
