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

// const { getSystemRequestContext } = require('@amzn/base-services/lib/helpers/system-context');

/**
 * A plugin method to implement any specific logic for the 'roles only' access logic when a study is registered
 *
 * @param requestContext The request context object containing principal (caller) information.
 * The principal's identifier object is expected to be available as "requestContext.principalIdentifier"
 * @param container Services container instance
 * @param accountEntity the data source account entity
 * @param bucketEntity the data source bucket entity
 * @param studyEntity the study entity (the permissions attribute is not expected to be populated)
 */
async function onStudyRegistration(payload) {
  const { requestContext, container, accountEntity, bucketEntity = {}, studyEntity = {} } = payload;
  // Allocating an application role is only applicable for bucket with access = 'roles'
  if (studyEntity.bucketAccess !== 'roles') return payload;
  // const systemContext = getSystemRequestContext();

  const applicationRoleService = await container.find('roles-only/applicationRoleService');
  const appRole = await applicationRoleService.allocateRole(requestContext, accountEntity, bucketEntity, studyEntity);

  const studyService = await container.find('studyService');
  const studyEntityUpdated = await studyService.update(requestContext, { id: studyEntity.id, appRoleArn: appRole.arn });

  const vpcePolicyService = await container.find('roles-only/vpcePolicyService');

  // Dynamically add the BYOB fs role to the STS VPCE Policy
  const stsVpceId = await vpcePolicyService.getVpceIdFromStudy(requestContext, studyEntity, 'STS');

  // null means this is not appstream enabled therefore these steps can be skipped.
  if (stsVpceId !== null) {
    const ec2Client = await vpcePolicyService.getEc2ServiceForStudy(requestContext, studyEntity);

    const { accountId, region } = studyEntity;

    const roleArn = `arn:aws:iam::${accountId}:role/swb-*-fs-*`;
    await vpcePolicyService.addRoleToStsVpcePolicy(ec2Client, roleArn, stsVpceId, 'AllowAssumeRole');

    // Dynamically add the BYOB bucket account to the KMS VPCE Policy if bucket is SSE-KMS encyrpted
    const isSseKmsEncrypted = appRole.bucketKmsArn;
    if (isSseKmsEncrypted) {
      const kmsVpceId = await vpcePolicyService.getVpceIdFromStudy(requestContext, studyEntity, 'KMS');
      await vpcePolicyService.addAccountToKmsVpcePolicy(ec2Client, accountId, kmsVpceId, region, 'BYOB Account Keys');
    }
  }

  return { ...payload, studyEntity: studyEntityUpdated, applicationRoleEntity: appRole };
}

/**
 * A plugin method to implement any specific logic for the 'roles only' access logic when the account cfn template
 * is requested.
 *
 * @param requestContext The request context object containing principal (caller) information.
 * @param container Services container instance
 * @param accountEntity the data source account entity
 * @param cfnTemplate An instance of The CfnTemplate class
 */
async function provideAccountCfnTemplate(payload) {
  const { requestContext, container, accountEntity, cfnTemplate } = payload;
  const applicationRoleService = await container.find('roles-only/applicationRoleService');
  const updatedCfnTemplate = await applicationRoleService.provideCfnResources(
    requestContext,
    cfnTemplate,
    accountEntity.id,
  );

  return { ...payload, cfnTemplate: updatedCfnTemplate };
}

/**
 * A plugin method to implement any specific logic for the 'roles-only' access logic when a environment
 * is about to be provisioned. This method simply delegates to the roles-only/EnvironmentResourceService
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

  const resourceService = await container.find('roles-only/environmentResourceService');
  await resourceService.allocateStudyResources(requestContext, { environmentScEntity, studies, memberAccountId });

  return payload;
}

/**
 * A plugin method to implement any specific logic for the 'roles-only' access logic when a environment
 * is terminated or failed provisioning. This method simply delegates to the roles-only/EnvironmentResourceService
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

  const resourceService = await container.find('roles-only/environmentResourceService');
  await resourceService.deallocateStudyResources(requestContext, { environmentScEntity, studies, memberAccountId });

  return payload;
}

async function provideEnvRolePolicy(payload) {
  const { requestContext, container, environmentScEntity, studies, policyDoc, memberAccountId } = payload;

  const resourceService = await container.find('roles-only/environmentResourceService');
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

  const resourceService = await container.find('roles-only/environmentResourceService');
  const updatedS3Mounts = await resourceService.provideStudyMount(requestContext, {
    environmentScEntity,
    studies,
    s3Mounts,
    memberAccountId,
  });

  return { ...payload, s3Mounts: updatedS3Mounts };
}

async function provideEnvEgressStorePolicy(payload) {
  const { requestContext, container, environmentScEntity, egressStore, policyDoc, memberAccountId } = payload;

  const resourceService = await container.find('roles-only/environmentResourceService');
  const updatedPolicyDoc = await resourceService.provideEnvEgressStorePolicy(requestContext, {
    environmentScEntity,
    egressStore,
    policyDoc,
    memberAccountId,
  });

  return { ...payload, policyDoc: updatedPolicyDoc };
}

const plugin = {
  onStudyRegistration,
  provideAccountCfnTemplate,
  allocateEnvStudyResources,
  deallocateEnvStudyResources,
  provideEnvRolePolicy,
  provideStudyMount,
  provideEnvEgressStorePolicy,
};

module.exports = plugin;
