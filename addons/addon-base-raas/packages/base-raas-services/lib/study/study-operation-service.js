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

const { StudyPolicy } = require('../helpers/iam/study-policy');
const { hasAccess, accessLevels } = require('./helpers/entities/study-methods');

const extensionPoint = 'study-access-strategy';

// An impacted user is a user who is listed in either usersToAdd section and/or usersToRemove section of
// the updateRequest object.
const getImpactedUsers = (updateRequest = {}) => {
  const addedUsers = _.map(updateRequest.usersToAdd, item => item.uid);
  const removedUsers = _.map(updateRequest.usersToRemove, item => item.uid);

  return _.uniq([...addedUsers, ...removedUsers]);
};

/**
 * This service is a higher level service than the study service. It understands that studies are mounted on
 * workspaces, and it orchestrates all the necessary logic when an operation is needed to be performed on studies.
 * For example, it orchestrates all the necessary logic when study permission changes and propagates all the way to
 * the relevant workspaces.
 */
class StudyOperationService extends Service {
  constructor() {
    super();
    this.dependency([
      'auditWriterService',
      'lockService',
      'studyService',
      'environmentScService',
      'pluginRegistryService',
    ]);
  }

  /**
   * This method not only updates the study/study permissions entities, but it also understands how to propagate the
   * permission changes to the workspaces. Therefore, this service is a higher level service than the study service.
   * It understands that studies are mounted on workspaces, and it orchestrates all the necessary logic to make
   * study permission changes propagate all the way to the relevant workspaces.
   *
   * @param requestContext The standard requestContext
   * @param studyId The study id
   * @param updateRequest The updateRequest object containing the information about which users to add/remove
   * including permission levels for the given study entity.
   *
   * The updateRequest should have the following shape:
   * {
   *  usersToAdd: [ {uid, permissionLevel}, ...]
   *  usersToRemove: [ {uid, permissionLevel}, ...]
   * }
   *
   * @returns studyPermissionsEntity
   */
  async updatePermissions(requestContext, studyId, updateRequest) {
    const [studyService, lockService, environmentScService] = await this.service([
      'studyService',
      'lockService',
      'environmentScService',
    ]);

    // First, we need to have a lock at the study operation level
    const result = await lockService.tryWriteLockAndRun({ id: `study-${studyId}-operation` }, async () => {
      // Currently, propagating permission is not done via a workflow, so we have to do everything in less than
      // 30 seconds. In an attempt to fail fast, an exception is thrown if we are trying to update more than
      // 100 workspaces. Let's start by getting all the impacted environments

      // An array that contains environment sc entities
      const impactedEnvironments = [];
      // An array that contains the user ids that are specified in the updateRequest, it does not matter if we are
      // adding or removing permissions for the user, as long as the user id appears in the updateRequest, then
      // the user is considered impacted.
      const impactedUsers = getImpactedUsers(updateRequest);

      // This function processes each user to find all the impacted environments for that user.
      // An impacted environment is any active environment owned by the user that contains the study
      const userProcessor = async userId => {
        const userEnvironments = await environmentScService.getActiveEnvsForUser(userId);
        const impacted = _.filter(userEnvironments, env => _.includes(env.studyIds, studyId));
        impactedEnvironments.push(...impacted);
      };

      // We want to process the impacted users, 5 at a time to figure out all the impacted environments
      await processInBatches(impactedUsers, 5, userProcessor);

      // We want to throw an exception and fail fast if the number of impacted environments > 100
      const total = _.size(impactedEnvironments);
      const limit = 100;
      if (total > limit) {
        throw this.boom.badRequest(
          `This operation requires the system to update ${total} workspaces. Please terminate some of the workspaces that are using the study, or update the permissions of a few users at time. The limit is ${limit} workspaces that can be updated at a time.`,
          true,
        );
      }

      // We want to get the study entity before the update, this is needed during the resource deallocation
      // logic so that we can find the exact role matching the exact permission level before the update
      const originalStudyEntity = await studyService.getStudyPermissions(requestContext, studyId);

      // Time to start the actual permission propagation logic. We start by updating the study permissions entity.

      // Permission enforcement is delegated to the study.updatePermissions() method. This is how we ensure that only
      // the study admin or the application admin can update the study permissions
      const updatedStudyEntity = await studyService.updatePermissions(requestContext, studyId, updateRequest);

      // For certain calls, the system context is used instead of the request context
      const systemContext = getSystemRequestContext();

      // The logic
      // We need to propagate the permission to all the workspaces that are using the study. Here are the steps:
      // - For each impacted environment, we do the the following:
      //   - We use the study-access-strategy extension point to call deallocateEnvStudyResources for the given
      //     study. This basically removes access to the study for the environment.
      //   - We then check the studyPermissions to see if the user has access to the study (for example,
      //     the user might have been promoted to higher level permission or demoted to lower level permission).
      //   - If the user still has access to the study, then we call allocateEnvStudyResources() for the study.
      //   - Then we call provideEnvRolePolicy() to get the iam policy and we update this policy in the active
      //     instance profile role in the appropriate aws account.
      // That is all.

      // An array to keep track of failures while processing the environments. Each element is an object with the
      // following shape: { environment, error }
      const erroredWorkspaces = [];

      // This function processes each environment, it is used when a call to the processInBatches is made
      const environmentProcessor = async env => {
        const { id, createdBy } = env;
        await lockService.tryWriteLockAndRun({ id: `environment-${id}-operation` }, async () => {
          try {
            const studyEntity = { ...updatedStudyEntity }; // We don't want to mutate the updatedStudyEntity
            const originalStudy = { ...originalStudyEntity }; // we don't want to mutate the originalStudyEntity

            // We need to remember the original permission level for this user for this environment
            originalStudy.envPermission = accessLevels(originalStudy, createdBy);

            // disable CIDR fetching to save latency. We don't need CIDR ranges here for de-allocation/allocation of
            // study
            const fetchCidr = false;

            // Get the environmentScEntity again, this is needed because the entity might have changed underneath us
            let environment = await environmentScService.find(systemContext, { id, fetchCidr });

            // We start by de-allocating previously allocated resources for the study (such as filesystem roles,
            // and certain statements from the bucket policy). We do that even if the user was not removed from the study.
            // Doing this logic makes the whole logic of propagating permissions much easier.
            const { accountId } = await environmentScService.getMemberAccount(requestContext, environment);
            await this.deallocateResources(requestContext, originalStudy, environment, accountId);

            // We need to get the environment sc entity again form the database in case the deallocateResources()
            // modified it in the database.
            environment = await environmentScService.find(systemContext, { id, fetchCidr });

            // After the study permissions were updated, does the user still have access?
            if (hasAccess(studyEntity, createdBy)) {
              // We now allocated the resources for the study again, doing so, allows the allocation to consider the new
              // permission level for the user for the study
              const { read, write } = accessLevels(studyEntity, createdBy);
              studyEntity.envPermission = { read, write };
              await this.allocateResources(requestContext, studyEntity, environment, accountId);
            }

            // This code is commented out because we do want to keep the fact that the environment had this study
            // selected when it was launched. This way if the study permissions change back and allow the user to
            // access the study, the study will become accessible again.
            // else {
            // We remove the study from the environment studyIds list
            // _.remove(environment.studyIds, item => item === studyEntity.id);
            // await environmentScService.updateStudyIds(requestContext, id, environment.studyIds);
            // }

            // We generate the iam policy so that we can update the instance profile role
            const policyDoc = await this.generateEnvRolePolicy(requestContext, environment, accountId);

            // Update the policy
            await environmentScService.updateRolePolicy(requestContext, environment, policyDoc);
          } catch (error) {
            erroredWorkspaces.push({ environment: env, error });
          }
        });
      };

      // We want to process the impacted environments, 10 at a time
      await processInBatches(impactedEnvironments, 10, environmentProcessor);

      // If we encountered errors, then we thrown an exception
      const wkErrorCount = _.size(erroredWorkspaces);
      if (wkErrorCount > 0) {
        throw this.boom.internalError(
          `Could not process at least ${wkErrorCount} workspace${wkErrorCount > 1 ? 's' : ''}`,
          true,
        );
      }

      return updatedStudyEntity;
    });

    // Write audit event
    await this.audit(requestContext, {
      action: 'update-study-permissions',
      body: { studyId, updateRequest, result },
    });

    return result;
  }

  // @private
  // Deallocate study resources
  async deallocateResources(requestContext, studyEntity, environmentScEntity, memberAccountId) {
    const pluginRegistryService = await this.service('pluginRegistryService');

    await pluginRegistryService.visitPlugins(extensionPoint, 'deallocateEnvStudyResources', {
      payload: {
        requestContext,
        container: this.container,
        environmentScEntity,
        studies: [studyEntity],
        memberAccountId,
      },
    });
  }

  // @private
  // Allocate study resources
  async allocateResources(requestContext, studyEntity, environmentScEntity, memberAccountId) {
    const pluginRegistryService = await this.service('pluginRegistryService');

    await pluginRegistryService.visitPlugins(extensionPoint, 'allocateEnvStudyResources', {
      payload: {
        requestContext,
        container: this.container,
        environmentScEntity,
        studies: [studyEntity],
        memberAccountId,
      },
    });
  }

  // @private
  // Build the iam policy document
  async generateEnvRolePolicy(requestContext, environmentScEntity, memberAccountId) {
    const policyDoc = new StudyPolicy();
    const [pluginRegistryService, environmentScService] = await this.service([
      'pluginRegistryService',
      'environmentScService',
    ]);
    const studies = await environmentScService.getStudies(requestContext, environmentScEntity);

    const result = await pluginRegistryService.visitPlugins(extensionPoint, 'provideEnvRolePolicy', {
      payload: {
        requestContext,
        container: this.container,
        environmentScEntity,
        studies,
        policyDoc,
        memberAccountId,
      },
    });

    const doc = _.get(result, 'policyDoc');
    return _.isUndefined(doc) ? {} : doc.toPolicyDoc();
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

module.exports = StudyOperationService;
