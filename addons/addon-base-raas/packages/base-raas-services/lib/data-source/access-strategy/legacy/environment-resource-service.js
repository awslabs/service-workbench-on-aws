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
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

const { parseS3Arn } = require('../../../helpers/s3-arn');
const { isOpenData } = require('../../../study/helpers/entities/study-methods');

const settingKeys = {
  studyDataBucketName: 'studyDataBucketName',
  studyDataKmsKeyArn: 'studyDataKmsKeyArn',
  studyDataKmsPolicyWorkspaceSid: 'studyDataKmsPolicyWorkspaceSid',
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

/**
 * This service is responsible for allocating and de-allocating AWS resources for the environment so that
 * the environment can access what it needs, such as studies.
 */
class EnvironmentResourceService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'lockService',
      'auditWriterService',
      'resourceUsageService',
    ]);
  }

  /**
   * Allocates all the necessary AWS resources to allow access to the studies. This includes updating
   * the bucket policy and the kms key policy.
   *
   * @param requestContext The request context object containing principal (caller) information
   * @param environmentScEntity the EnvironmentSc entity
   * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element
   * in the array is the standard StudyEntity, however, there is one additional attributes added to each
   * of the StudyEntity. This additional attribute is called 'envPermission', it is an object with the
   * following shape: { read: true/false, write: true/false }
   */
  async allocateStudyResources(requestContext, { environmentScEntity, studies: allStudies, memberAccountId }) {
    // Legacy access strategy is only applicable for studies that have resources attributes
    const studies = _.filter(allStudies, study => !_.isEmpty(study.resources));

    if (_.isEmpty(studies)) return; // No legacy access to deal with

    const bucketName = this.settings.get(settingKeys.studyDataBucketName);
    const lockService = await this.service('lockService');
    const lockId = `bucket-policy-access-${bucketName}`;

    await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
      // We need to use the resourceUsageService to figure out if we already allocated
      // resources for this member account. We need to do that per study. Therefore, we are
      // tracking the environments that are accessing studies for the given remember accounts.
      const usageService = await this.service('resourceUsageService');
      const studiesToAdd = [];
      const processor = async study => {
        const usage = await usageService.addUsage(requestContext, {
          resource: `legacy-access-study-${study.id}`,
          setName: memberAccountId,
          item: environmentScEntity.id,
        });

        if (_.size(usage.items) >= 1) studiesToAdd.push(study);
      };

      // We do the usage tracking calls, 20 at a time
      await processInBatches(studies, 20, processor);

      if (_.isEmpty(studiesToAdd)) return; // No studies to add at the member account level

      // Add permissions in the bucket policy for the environment member account to access
      // the studies. Keep in mind that the existing code will allow the member account r/w access
      // to the study. Then, we further restrict access for the workspace when we create the
      // instance profile role policy.
      await this.addToBucketPolicy(requestContext, studiesToAdd, memberAccountId);

      // We want to track all the environments that are accessing the studies at the member account level
      const usage = await usageService.addUsage(requestContext, {
        resource: `legacy-access-member-account-${memberAccountId}`,
        setName: memberAccountId,
        item: environmentScEntity.id,
      });

      if (_.size(usage.items) >= 1) {
        // Add permissions in the main account kms key policy for the environment member account to be able to use this key
        await this.addToKmsKeyPolicy(requestContext, memberAccountId);
      }
    });
  }

  /**
   * Deallocate all the necessary AWS resources to remove access to the studies. This includes updating
   * the bucket policy and the kms key policy.
   *
   * @param requestContext The request context object containing principal (caller) information
   * @param environmentScEntity the EnvironmentSc entity
   * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element
   * in the array is the standard StudyEntity, however, there is one additional attributes added to each
   * of the StudyEntity. This additional attribute is called 'envPermission', it is an object with the
   * following shape: { read: true/false, write: true/false }
   */
  async deallocateStudyResources(requestContext, { environmentScEntity, studies: allStudies, memberAccountId }) {
    // Legacy access strategy is only applicable for studies that have resources attributes
    const studies = _.filter(allStudies, study => !_.isEmpty(study.resources));

    if (_.isEmpty(studies)) return; // No legacy access to deal with

    const bucketName = this.settings.get(settingKeys.studyDataBucketName);
    const lockService = await this.service('lockService');
    const lockId = `bucket-policy-access-${bucketName}`;

    await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
      // We need to use the resourceUsageService to figure out if we already removed
      // resources for this member account. We need to do that per study.
      const usageService = await this.service('resourceUsageService');
      const studiesToRemove = [];
      const processor = async study => {
        const usage = await usageService.removeUsage(requestContext, {
          resource: `legacy-access-study-${study.id}`,
          setName: memberAccountId,
          item: environmentScEntity.id,
        });

        if (_.isEmpty(usage.items)) studiesToRemove.push(study);
      };

      // We do the usage tracking calls, 20 at a time
      await processInBatches(studies, 20, processor);

      await this.removeFromBucketPolicy(requestContext, studiesToRemove, memberAccountId);

      // We want to track all the environments that are accessing the studies at the member account level
      const usage = await usageService.removeUsage(requestContext, {
        resource: `legacy-access-member-account-${memberAccountId}`,
        setName: memberAccountId,
        item: environmentScEntity.id,
      });

      if (_.isEmpty(usage.items)) {
        await this.removeFromKmsKeyPolicy(requestContext, memberAccountId);
      }
    });
  }

  async provideEnvRolePolicy(requestContext, { policyDoc, studies: allStudies }) {
    // Legacy access strategy is only applicable for studies that have resources attributes
    const studies = _.filter(allStudies, study => !_.isEmpty(study.resources));

    if (_.isEmpty(studies)) return policyDoc; // No legacy access to deal with

    // Since these studies are using the default bucket, we know that they are using the default bucket kms arn.
    const kmsArn = await this.getKmsKeyIdArn();
    // Get the default bucket name
    const bucketName = this.settings.get(settingKeys.studyDataBucketName);

    _.forEach(studies, study => {
      const { resources, envPermission } = study;
      policyDoc.addStudy({ bucket: bucketName, kmsArn, resources, permission: envPermission });
    });

    return policyDoc;
  }

  async provideStudyMount(requestContext, { studies: allStudies, s3Mounts }) {
    // Legacy access strategy is only applicable for studies that have resources attributes
    const studies = _.filter(allStudies, study => !_.isEmpty(study.resources));

    if (_.isEmpty(studies)) return s3Mounts; // No legacy access to deal with

    // Since these studies are using the default bucket, we know that they are using the default bucket
    // kms arn.
    const kmsArn = await this.getKmsKeyIdArn();
    const addToMounts = mount => s3Mounts.push(mount);

    _.forEach(studies, study => {
      const { id, resources = [], envPermission = {} } = study;
      const { read, write } = envPermission;
      const item = { id, readable: read, writeable: write };
      const getBucketAndPrefix = (resource = {}) => {
        const { bucket, prefix } = parseS3Arn(resource.arn) || {};
        return { bucket, prefix };
      };

      if (!isOpenData(study)) {
        // All studies with the exception of open data studies, only have one resource
        addToMounts({ ...item, kmsArn, ...getBucketAndPrefix(_.nth(resources, 0)) });
        return;
      }

      // We need to account for the fact that an open data study might have many resources
      if (_.size(resources) === 1) {
        addToMounts({ ...item, ...getBucketAndPrefix(resources[0]) });
        return;
      }

      let counter = 0;
      _.forEach(resources, resource => {
        counter += 1;
        // When we have multiple resources in an open data, we need to adjust the study id on the fly
        addToMounts({ ...item, ...getBucketAndPrefix(resource), id: `${id}-${counter}` });
      });
    });

    return s3Mounts;
  }

  // @private
  async addToBucketPolicy(requestContext, studies, memberAccountId) {
    // studies is an array of StudyEntity. IMPORTANT: each element in the array is the standard StudyEntity, however,
    // there is one additional attributes added to each of the StudyEntity. This additional attribute is called
    // 'envPermission', it is an object with the following shape: { read: true/false, write: true/false }
    const { s3BucketName, s3Policy } = await this.getS3BucketAndPolicy();
    const internalStudies = await this.getInternalStudies(studies, s3BucketName);
    const filteredStudies = _.filter(
      internalStudies,
      study => study.envPermission && (study.envPermission.read || study.envPermission.write),
    );

    // construct the revised statements depending on the type of permissions
    const revisedStatements = await Promise.all(
      _.map(filteredStudies, async study => {
        const statementParamFunctions = [];
        if (study.envPermission.read) {
          statementParamFunctions.push(getStatementParamsFn);
        }
        if (study.envPermission.write) {
          statementParamFunctions.push(putStatementParamsFn);
        }
        if (study.envPermission.read || study.envPermission.write) {
          statementParamFunctions.push(listStatementParamsFn);
        }
        const revisedStatementsPerStudy = await this.getRevisedS3Statements(
          s3Policy,
          study,
          s3BucketName,
          statementParamFunctions,
          oldStatement => this.addAccountToStatement(oldStatement, memberAccountId),
        );
        return revisedStatementsPerStudy;
      }),
    );
    await this.updateS3BucketPolicy(s3BucketName, s3Policy, revisedStatements);

    // Write audit event
    await this.audit(requestContext, { action: 'add-to-bucket-policy', body: s3Policy });
  }

  // @private
  async removeFromBucketPolicy(requestContext, studies, memberAccountId) {
    // studies is an array of StudyEntity. IMPORTANT: each element in the array is the standard StudyEntity, however,
    // there is one additional attributes added to each of the StudyEntity. This additional attribute is called
    // 'envPermission', it is an object with the following shape: { read: true/false, write: true/false }
    const { s3BucketName, s3Policy } = await this.getS3BucketAndPolicy();
    const filteredStudies = await this.getInternalStudies(studies, s3BucketName);

    // construct the revised statements for all types of statements and remove the memberAccountId
    const revisedStatements = await Promise.all(
      _.map(filteredStudies, async study => {
        const statementParamFunctions = [getStatementParamsFn, putStatementParamsFn, listStatementParamsFn];
        const revisedStatementsPerStudy = await this.getRevisedS3Statements(
          s3Policy,
          study,
          s3BucketName,
          statementParamFunctions,
          oldStatement => this.removeAccountFromStatement(oldStatement, memberAccountId),
        );
        return revisedStatementsPerStudy;
      }),
    );
    await this.updateS3BucketPolicy(s3BucketName, s3Policy, revisedStatements);

    // Write audit event
    await this.audit(requestContext, { action: 'remove-from-bucket-policy', body: s3Policy });
  }

  // @private
  async addToKmsKeyPolicy(requestContext, memberAccountId) {
    await this.updateKMSPolicy(environmentStatement =>
      this.addAccountToStatement(environmentStatement, memberAccountId),
    );

    // Write audit event
    await this.audit(requestContext, { action: 'add-to-KmsKey-policy', body: memberAccountId });
  }

  // @private
  async removeFromKmsKeyPolicy(requestContext, memberAccountId) {
    await this.updateKMSPolicy(environmentStatement =>
      this.removeAccountFromStatement(environmentStatement, memberAccountId),
    );

    // Write audit event
    await this.audit(requestContext, { action: 'add-to-KmsKey-policy', body: memberAccountId });
  }

  // @private
  async getKmsKeyIdArn() {
    // Get the kms key id
    const kmsAliasArn = this.settings.get(settingKeys.studyDataKmsKeyArn);

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

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  // @private
  async getS3BucketAndPolicy() {
    const s3BucketName = this.settings.get(settingKeys.studyDataBucketName);
    const s3Client = await this.getS3();
    const s3Policy = JSON.parse((await s3Client.getBucketPolicy({ Bucket: s3BucketName }).promise()).Policy);
    if (!s3Policy.Statement) {
      s3Policy.Statement = [];
    }
    return { s3BucketName, s3Policy };
  }

  // @private
  async getInternalStudies(studies, s3BucketName) {
    // Work on studies that satisfy the following filter:
    // 1. Studies should not be open data since we don't control the bucket policy of those buckets
    // 2. Studies belong to the bucket specified by settings studyDataBucketName
    // 3. Studies are assumed to have only single S3 arn. If multiple are provided then only the first arn is used
    const filteredStudies = _.filter(studies, study => !isOpenData(study) && study.resources)
      .map(study => {
        const { bucket, prefix } = parseS3Arn(study.resources[0].arn) || {};
        study.prefix = prefix;
        study.bucket = bucket;
        return study;
      })
      .filter(study => study.prefix && study.bucket === s3BucketName);
    return filteredStudies;
  }

  // @private
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
  removeAccountFromStatement(oldStatement, memberAccountId) {
    const principal = this.getRootArnForAccount(memberAccountId);
    const statement = this.addEmptyPrincipalIfNotPresent(oldStatement);
    if (Array.isArray(statement.Principal.AWS)) {
      statement.Principal.AWS = statement.Principal.AWS.filter(oldPrincipal => oldPrincipal !== principal);
    } else if (statement.Principal.AWS === principal) {
      statement.Principal.AWS = [];
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
  async getRevisedS3Statements(s3Policy, study, bucket, statementParamFunctions, updateStatementFn) {
    const revisedStatementsPerStudy = _.map(statementParamFunctions, statementParameterFn => {
      const statementParams = statementParameterFn(bucket, study.prefix);
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
  async updateKMSPolicy(updateStatementFn) {
    const kmsClient = await this.getKMS();
    const kmsKeyAlias = this.settings.get(settingKeys.studyDataKmsKeyArn);
    const keyId = (await kmsClient.describeKey({ KeyId: kmsKeyAlias }).promise()).KeyMetadata.KeyId;

    // Get existing policy
    const kmsPolicy = JSON.parse(
      (await kmsClient.getKeyPolicy({ KeyId: keyId, PolicyName: 'default' }).promise()).Policy,
    );

    // Get statement
    const sid = this.settings.get(settingKeys.studyDataKmsPolicyWorkspaceSid);
    if (!kmsPolicy.Statement) {
      kmsPolicy.Statement = [];
    }
    let environmentStatement = kmsPolicy.Statement.find(statement => statement.Sid === sid);
    if (!environmentStatement) {
      // Create new statement if it doesn't already exist
      environmentStatement = {
        Sid: sid,
        Effect: 'Allow',
        Principal: { AWS: [] },
        Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
        Resource: '*', // Only refers to this key since it's a resource policy
      };
    }

    // Update policy
    environmentStatement = await updateStatementFn(environmentStatement);

    // remove the old statement from KMS policy
    kmsPolicy.Statement = kmsPolicy.Statement.filter(statement => statement.Sid !== sid);

    // add the revised statement if it contains principals (otherwise leave it out)
    if (environmentStatement.Principal.AWS.length > 0) {
      kmsPolicy.Statement.push(environmentStatement);
    }
    await kmsClient.putKeyPolicy({ KeyId: keyId, PolicyName: 'default', Policy: JSON.stringify(kmsPolicy) }).promise();
  }

  async getS3() {
    const aws = await this.getAWS();
    return new aws.sdk.S3();
  }

  async getKMS() {
    const aws = await this.getAWS();
    return new aws.sdk.KMS();
  }

  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }
}

module.exports = EnvironmentResourceService;
