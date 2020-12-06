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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const { CfnTemplate } = require('../helpers/cfn-template');

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
  const { container, accountEntity, bucketEntity = {}, studyEntity = {} } = payload;
  // Allocating an application role is only applicable for bucket with access = 'roles'
  if (studyEntity.bucketAccess !== 'roles') return payload;
  const systemContext = getSystemRequestContext();

  const applicationRoleService = await container.find('roles-only/applicationRoleService');
  const appRole = await applicationRoleService.allocateRole(systemContext, accountEntity, bucketEntity, studyEntity);

  const studyService = await container.find('studyService');
  const studyEntityUpdated = await studyService.update(systemContext, { id: studyEntity.id, appRoleArn: appRole.arn });

  return { ...payload, studyEntity: studyEntityUpdated, applicationRoleEntity: appRole };
}

/**
 * A plugin method to implement any specific logic for the 'roles only' access logic when the account cfn template
 * is requested.
 *
 * @param requestContext The request context object containing principal (caller) information.
 * @param container Services container instance
 * @param accountEntity the data source account entity
 */
async function provideAccountCfnTemplate(payload) {
  const { requestContext, container, accountEntity } = payload;
  const { id, mainRegion, stack, stackCreated } = accountEntity;
  const applicationRoleService = await container.find('roles-only/applicationRoleService');
  const cfnTemplate = new CfnTemplate();
  await applicationRoleService.provideCfnResources(requestContext, cfnTemplate, accountEntity.id);

  const accountTemplateInfo = {
    // id: '',  TODO
    name: stack,
    region: mainRegion,
    accountId: id,
    created: stackCreated,
    template: cfnTemplate.toJson(),
  };

  return { ...payload, accountTemplateInfo };
}

const plugin = {
  onStudyRegistration,
  provideAccountCfnTemplate,
};

module.exports = plugin;
