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

/**
 * A plugin method to implement any specific logic for the 'legacy' access logic when a environment
 * is about to be provisioned. This method simply delegates to the legacy/EnvironmentResourceService
 *
 * @param requestContext The request context object containing principal (caller) information.
 * @param container Services container instance
 * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element
 * in the array is the standard StudyEntity, however, there is one additional attributes added to each
 * of the StudyEntity. This additional attribute is called 'envPermission', it is an object with the
 * following shape: { read: true/false, write: true/false }
 */
async function allocateEnvStudyResources(payload) {
  const { requestContext, container, environmentScEntity, studies, memberAccountId } = payload;

  const resourceService = await container.find('legacy/environmentResourceService');
  await resourceService.allocateStudyResources(requestContext, { environmentScEntity, studies, memberAccountId });

  return payload;
}

/**
 * A plugin method to implement any specific logic for the 'legacy' access logic when a environment
 * is terminated or failed provisioning. This method simply delegates to the legacy/EnvironmentResourceService
 *
 * @param requestContext The request context object containing principal (caller) information.
 * @param container Services container instance
 * @param studies an array of StudyEntity that are associated with this env. IMPORTANT: each element
 * in the array is the standard StudyEntity, however, there is one additional attributes added to each
 * of the StudyEntity. This additional attribute is called 'envPermission', it is an object with the
 * following shape: { read: true/false, write: true/false }
 */
async function deallocateEnvStudyResources(payload) {
  const { requestContext, container, environmentScEntity, studies, memberAccountId } = payload;

  const resourceService = await container.find('legacy/environmentResourceService');
  await resourceService.deallocateStudyResources(requestContext, { environmentScEntity, studies, memberAccountId });

  return payload;
}

async function provideEnvRolePolicy(payload) {
  const { requestContext, container, environmentScEntity, studies, policyDoc, memberAccountId } = payload;

  const resourceService = await container.find('legacy/environmentResourceService');
  const updatedPolicyDoc = await resourceService.provideEnvRolePolicy(requestContext, {
    environmentScEntity,
    studies,
    policyDoc,
    memberAccountId,
  });

  return { ...payload, policyDoc: updatedPolicyDoc };
}

async function provideStudyMount(payload) {
  const { requestContext, container, environmentScEntity, studies, s3Mounts, memberAccountId } = payload;

  const resourceService = await container.find('legacy/environmentResourceService');
  const updatedS3Mounts = await resourceService.provideStudyMount(requestContext, {
    environmentScEntity,
    studies,
    s3Mounts,
    memberAccountId,
  });

  return { ...payload, s3Mounts: updatedS3Mounts };
}

const plugin = {
  allocateEnvStudyResources,
  deallocateEnvStudyResources,
  provideEnvRolePolicy,
  provideStudyMount,
};

module.exports = plugin;
