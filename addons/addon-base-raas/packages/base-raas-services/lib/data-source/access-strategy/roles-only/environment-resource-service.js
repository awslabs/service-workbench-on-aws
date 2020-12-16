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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

/**
 * This service is responsible for allocating and de-allocating AWS resources for the environment so that
 * the environment can access what it needs, such as studies. This service implements the roles only
 * study access strategy.
 */
class EnvironmentResourceService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'lockService',
      'auditWriterService',
      'roles-only/filesystemRoleService',
      'resourceUsageService',
      'environmentScService',
      'dataSourceBucketService',
    ]);
  }

  /**
   * Allocates all the necessary AWS resources to allow access to the studies. This includes acquiring the necessary
   * filesystem roles, as needed.
   *
   * @param requestContext The request context object containing principal (caller) information
   * @param environmentScEntity the EnvironmentSc entity. The entity is expected to have an attributed named 'studyRoles'.
   * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element
   * in the array is the standard StudyEntity, however, there is one additional attributes added to each
   * of the StudyEntity. This additional attribute is called 'envPermission', it is an object with the
   * following shape: { read: true/false, write: true/false }
   */
  async allocateStudyResources(requestContext, { environmentScEntity, studies: allStudies, memberAccountId }) {
    // We are only interested in studies with bucket access = 'roles'
    const studies = _.filter(allStudies, study => study.bucketAccess === 'roles');

    if (_.isEmpty(studies)) return; // No relevant studies for this access strategy, so we are done

    // The keys are the study ids and the values are the filesystem role arns
    const studiesMap = environmentScEntity.studyRoles || {};
    environmentScEntity.studyRoles = studiesMap; // In case it didn't have a map

    // The logic
    // - We group studies by their appRoleArn, this makes the locking a bit more efficient
    // - Then for each group (in batches), we do the following logic:
    //   - For each study, we ask the filesystem role system service to allocate the role for us
    // - After we obtain all the necessary filesystem roles, we store them in the environmentScEntity studyRoles

    const lockService = await this.service('lockService');
    const filesystemRoleService = await this.service('roles-only/filesystemRoleService');
    const environmentService = await this.service('environmentScService');

    // For certain calls, the system context is used instead of the request context
    const systemContext = getSystemRequestContext();

    // groups is an object where the keys are the appRoleArn and the values are arrays
    // of the studyEntities. Example:
    // groups = { '<appRoleArn1>': [ <studyEntity>, ... ], '<appRoleArn1>': [ <studyEntity>, ... ]}
    const groups = _.groupBy(studies, 'appRoleArn');
    const groupProcessor = async group => {
      // group is an array of study entities where they all have the same app role arn
      const appRoleArn = _.get(_.nth(group, 0), 'appRoleArn', '');
      const lockId = `roles-only-access-app-role-${appRoleArn}`;

      await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
        // For each study, we ask the filesystem role system service to allocate the role for us
        // eslint-disable-next-line no-restricted-syntax
        for (const study of group) {
          const fsRoleEntity = await filesystemRoleService.allocateRole(
            systemContext,
            study,
            environmentScEntity,
            memberAccountId,
          );

          studiesMap[study.id] = fsRoleEntity.arn;
        }
      });
    };

    // We want to process the groups 10 at a time
    await processInBatches(_.values(groups), 10, groupProcessor);

    // Time to update the study role map in the environment entity
    await environmentService.updateStudyRoles(systemContext, environmentScEntity.id, studiesMap);
  }

  /**
   * Deallocate all the necessary AWS resources to remove access to the studies. This might require, for example,
   * releasing the filesystem roles.
   *
   * @param requestContext The request context object containing principal (caller) information
   * @param environmentScEntity the EnvironmentSc entity. The entity is expected to have an attributed named 'studyRoles'.
   * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element
   * in the array is the standard StudyEntity, however, there is one additional attributes added to each
   * of the StudyEntity. This additional attribute is called 'envPermission', it is an object with the
   * following shape: { read: true/false, write: true/false }
   */
  async deallocateStudyResources(requestContext, { environmentScEntity, studies: allStudies, memberAccountId }) {
    // We are only interested in studies with bucket access = 'roles'
    const studies = _.filter(allStudies, study => study.bucketAccess === 'roles');

    if (_.isEmpty(studies)) return; // No relevant studies for this access strategy, so we are done

    // The logic
    // - We group studies by their appRoleArn, this makes the locking a bit more efficient
    // - Then for each group (in batches), we do the following logic:
    //   - For each study, we ask the filesystem role system service to deallocate the role for us
    //   - We deleted the study role entry in the studies map
    // - After we release all the necessary filesystem roles, we update the study roles in the environmentScEntity

    const studyRoles = environmentScEntity.studyRoles || {};
    const lockService = await this.service('lockService');
    const filesystemRoleService = await this.service('roles-only/filesystemRoleService');
    const environmentService = await this.service('environmentScService');

    // For certain calls, the system context is used instead of the request context
    const systemContext = getSystemRequestContext();

    // groups is an object where the keys are the appRoleArn and the values are arrays
    // of the studyEntities. Example:
    // groups = { '<appRoleArn1>': [ <studyEntity>, ... ], '<appRoleArn1>': [ <studyEntity>, ... ]}
    const groups = _.groupBy(studies, 'appRoleArn');
    const groupProcessor = async group => {
      // group is an array of study entities where they all have the same app role arn
      const appRoleArn = _.get(_.nth(group, 0), 'appRoleArn', '');
      const lockId = `roles-only-access-app-role-${appRoleArn}`;

      await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
        // For each study, we ask the filesystem role system service to deallocate the role for us
        // eslint-disable-next-line no-restricted-syntax
        for (const study of group) {
          const fsRoleArn = studyRoles[study.id];
          // eslint-disable-next-line no-continue
          if (_.isEmpty(fsRoleArn)) continue;
          await filesystemRoleService.deallocateRole(
            systemContext,
            fsRoleArn,
            study,
            environmentScEntity,
            memberAccountId,
          );

          delete studyRoles[study.id];
        }
      });
    };

    // We want to process the groups 10 at a time
    await processInBatches(_.values(groups), 10, groupProcessor);

    // Time to update the study role map in the environment entity
    await environmentService.updateStudyRoles(systemContext, environmentScEntity.id, studyRoles);
  }

  /**
   * Populate the policy document that is going to be used as an inline policy document in the instance profile role
   * of the compute resource. It is important to keep in mind that other study access strategy might be participating
   * in this logic.
   *
   * @param requestContext The standard request context object
   * @param policyDoc An instance of the StudyPolicy class
   * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element in the array is
   * the standard StudyEntity, however, there is one additional attributes added to each of the StudyEntity. This
   * additional attribute is called 'envPermission', it is an object with the following shape:
   * { read: true/false, write: true/false }
   * @param environmentScEntity the EnvironmentSc entity. The entity is expected to have an attributed named 'studyRoles'.
   * The studyRoles is a map where the key is the study id and the value is the fs role arn
   *
   */
  async provideEnvRolePolicy(requestContext, { policyDoc, studies: allStudies, environmentScEntity }) {
    // We are only interested in studies with bucket access = 'roles'
    const studies = _.filter(allStudies, study => study.bucketAccess === 'roles');

    if (_.isEmpty(studies)) return policyDoc; // No relevant studies for this access strategy, so we are done

    _.forEach(studies, study => {
      const roleArn = _.get(environmentScEntity, 'studyRoles', {})[study.id];
      policyDoc.addStudyRole(roleArn);
    });

    return policyDoc;
  }

  /**
   * Populate s3 mount information that is going to be passed to the user data of the compute instance. This s3 mount
   * information is then used by the mount script that runs on the compute instance. It is important to keep in mind
   * that other study access strategy might be participating in this logic.
   *
   * @param requestContext The standard request context object
   * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element in the array is
   * the standard StudyEntity, however, there is one additional attributes added to each of the StudyEntity. This
   * additional attribute is called 'envPermission', it is an object with the following shape:
   * { read: true/false, write: true/false }
   * @param s3Mounts An array that contains the s3 mount information. Each element in the array is an object with the
   * following shape: { id, bucket, region, awsPartition, kmsArn, prefix, roleArn, readable, writable }
   * @param environmentScEntity the EnvironmentSc entity. The entity is expected to have an attributed named 'studyRoles'.
   * The studyRoles is a map where the key is the study id and the value is the fs role arn
   */
  async provideStudyMount(requestContext, { studies: allStudies, s3Mounts, environmentScEntity }) {
    // We are only interested in studies with bucket access = 'roles'
    const studies = _.filter(allStudies, study => study.bucketAccess === 'roles');

    if (_.isEmpty(studies)) return s3Mounts; // No relevant studies for this access strategy, so we are done

    // We loop through all the studies and add items to the s3 mount information array
    _.forEach(studies, study => {
      const { id, bucket, kmsScope, folder, region, awsPartition, envPermission = {} } = study;
      const { read, write } = envPermission;
      // The logic to determining the kmsArn logic is:
      // - If the study kms scope is 'bucket', then we don't include the kmsArn in the mount information, this way
      //   the default bucket kms will be used by S3 without needing to pass the exact kms arn
      // - If the study kms scope is 'study', then we need to include the kmsArn in the mount information
      const kmsArn = kmsScope === 'study' ? study.kmsArn : undefined;
      const roleArn = _.get(environmentScEntity, 'studyRoles', {})[id];
      const item = { id, bucket, region, kmsArn, roleArn, prefix: folder, readable: read, writeable: write };
      if (awsPartition !== 'aws') item.awsPartition = awsPartition;

      s3Mounts.push(item);
    });

    return s3Mounts;
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
