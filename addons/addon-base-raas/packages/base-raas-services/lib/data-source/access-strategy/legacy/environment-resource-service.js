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

        if (usage.added && _.size(usage.items) === 1) studiesToAdd.push(study);
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

      if (usage.added && _.size(usage.items) === 1) {
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

        if (usage.removed && _.isEmpty(usage.items)) studiesToRemove.push(study);
      };

      // We do the usage tracking calls, 20 at a time
      await processInBatches(studies, 20, processor);

      if (_.isEmpty(studiesToRemove)) return; // No studies to remove at the member account level

      await this.removeFromBucketPolicy(requestContext, studiesToRemove, memberAccountId);

      // We want to track all the environments that are accessing the studies at the member account level
      const usage = await usageService.removeUsage(requestContext, {
        resource: `legacy-access-member-account-${memberAccountId}`,
        setName: memberAccountId,
        item: environmentScEntity.id,
      });

      if (usage.removed && _.isEmpty(usage.items)) {
        await this.removeFromKmsKeyPolicy(requestContext, memberAccountId);
      }
    });
  }

  async provideEnvRolePolicy(requestContext, { policyDoc, studies: allStudies }) {
    // Legacy access strategy is only applicable for studies that have resources attributes
    const studies = _.filter(allStudies, study => !_.isEmpty(study.resources));

    if (_.isEmpty(studies)) return; // No legacy access to deal with

    // Since these studies are using the default bucket, we know that they are using the default bucket kms arn.
    const kmsArn = await this.getKmsKeyIdArn();
    // Get the default bucket name
    const bucketName = this.settings.get(settingKeys.studyDataBucketName);

    _.forEach(studies, study => {
      const { resources, envPermission } = study;
      policyDoc.addStudy({ bucket: bucketName, kmsArn, resources, permission: envPermission });
    });
  }

  async provideStudyMount(requestContext, { studies: allStudies, s3Mounts }) {
    // Legacy access strategy is only applicable for studies that have resources attributes
    const studies = _.filter(allStudies, study => !_.isEmpty(study.resources));

    if (_.isEmpty(studies)) return; // No legacy access to deal with

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
  }

  // @private
  async addToBucketPolicy(requestContext, studies, memberAccountId) {
    // studies is an array of StudyEntity. IMPORTANT: each element in the array is the standard StudyEntity, however,
    // there is one additional attributes added to each of the StudyEntity. This additional attribute is called
    // 'envPermission', it is an object with the following shape: { read: true/false, write: true/false }

    const bucketName = this.settings.get(settingKeys.studyDataBucketName);

    // TODO - legacy work
    // Ensure that you only add the studies to the bucket policy if they are not already there.
    // Same goes for the memberAccountId.
    //
    // The logic
    // Most of this logic is similar to the one in EnvironmentMountService._updateResourcePolicies() method
    // Here are the steps:
    // - Take a look at EnvironmentMountService._updateResourcePolicies()
    // - Load the bucket policy
    // - Update the statements using a similar logic to the one done the EnvironmentMountService._updateResourcePolicies()
    // - Keep in mind that you have memberAccountId handy, so there is no need for workspaceRoleArn
    // - Do not add the exact same principal to the exact same statement if it is already there
    // - No need to create any lock here, it is already taken care of in the allocateStudyResources() method
    //
    // NOTE: unlike EnvironmentMountService._updateResourcePolicies(), we don't update the kms key policy in this
    // method, instead, the update of the kms key policy is done in a addToKmsKeyPolicy.  Don't call addToKmsKeyPolicy
    // from this method.
  }

  // @private
  async removeFromBucketPolicy(requestContext, studies, memberAccountId) {
    // studies is an array of StudyEntity. IMPORTANT: each element in the array is the standard StudyEntity, however,
    // there is one additional attributes added to each of the StudyEntity. This additional attribute is called
    // 'envPermission', it is an object with the following shape: { read: true/false, write: true/false }

    const bucketName = this.settings.get(settingKeys.studyDataBucketName);

    // TODO - legacy work
    // The logic
    //
    // Most of this logic is similar to the one in EnvironmentMountService._updateResourcePolicies() method
    // Here are the steps:
    // - Take a look at EnvironmentMountService._updateResourcePolicies()
    // - Load the bucket policy
    // - Remove the studies but only if the only principal left is the memberAccountId provided,
    //   otherwise just remove the memberAccountId from the statements that include the studies provided.
    // - No need to create any lock here, it is already taken care of in the deallocateStudyResources() method
    //
    // NOTE: unlike EnvironmentMountService._updateResourcePolicies(), we don't update the kms key policy in this
    // method, instead, the update of the kms key policy is done in a addToKmsKeyPolicy.  Don't call addToKmsKeyPolicy
    // from this method.
  }

  // @private
  async addToKmsKeyPolicy(requestContext, memberAccountId) {
    const studyDataKmsKeyArn = await this.getKmsKeyIdArn();

    // TODO - legacy work
    // Ensure that you only add the memberAccountId to kms key policy, if it is not already here.
    //
    // The logic
    // Most of this logic is similar to the last part of EnvironmentMountService._updateResourcePolicies() method
    // Here are the steps:
    // - Take a look at the last part for EnvironmentMountService._updateResourcePolicies()
    // - Load the kms key policy
    // - Update the statements using a similar logic to the one done the EnvironmentMountService._updateResourcePolicies()
    // - Keep in mind that you have memberAccountId handy
    // - Do not add the exact same principal to the exact same statement if it is already there
    // - No need to create any lock here, it is already taken care of in the allocateStudyResources() method
  }

  // @private
  async removeFromKmsKeyPolicy(requestContext, memberAccountId) {
    const studyDataKmsKeyArn = await this.getKmsKeyIdArn();

    // TODO - legacy work
    //
    // The logic
    // - Take a look at the last part for EnvironmentMountService.removeRoleArnFromLocalResourcePolicies()
    // - Load the kms key policy
    // - Remove the memberAccountId if it is in the policy. Don't worry about if other workspaces in the same
    //   member account are still using the kms key. This is because this method is only called if we are sure
    //   that there are no more workspaces in the member account (this was done using the usage service).
    // - No need to create any lock here, it is already taken care of in the deallocateStudyResources() method
  }

  // @private
  async getKmsKeyIdArn() {
    // Get the kms key id
    const kmsAliasArn = this.settings.get(settingKeys.studyDataKmsKeyArn);

    // Get KMS Key ARN from KMS Alias ARN
    // The "Decrypt","DescribeKey","GenerateDataKey" etc require KMS KEY ARN and not ALIAS ARN
    const aws = await this.service('aws');
    const kmsClient = new aws.sdk.KMS();
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
}

module.exports = EnvironmentResourceService;
