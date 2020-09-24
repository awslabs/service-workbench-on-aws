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

const { listValue, common } = require('../helpers/transforms');
const passwordsTransforms = require('./password-transforms');
const userApiKeysTransforms = require('./user-api-keys-transforms');
const keyPairsTransforms = require('./key-pairs-transforms');
const studyPermissionsTransforms = require('./study-permissions-transforms');
const workflowDraftsTransforms = require('./workflow-drafts-transforms');

const tables = () => [
  { name: 'DeploymentStore', keys: ['type', 'id'], transforms: common },
  { name: 'Passwords', keys: ['username'], transforms: [...passwordsTransforms, ...common] },
  { name: 'UserApiKeys', keys: ['id'], transforms: [...userApiKeysTransforms, ...common] },
  { name: 'AuthenticationProviderTypes', keys: ['type'], transforms: common },
  { name: 'AuthenticationProviderConfigs', keys: ['id'], transforms: common },
  { name: 'StepTemplates', keys: ['id', 'ver'], transforms: common },
  { name: 'WorkflowTemplates', keys: ['id', 'ver'], transforms: common },
  { name: 'Workflows', keys: ['id', 'ver'], transforms: common },
  { name: 'WfAssignments', keys: ['id'], transforms: common },
  { name: 'WorkflowInstances', keys: ['id'], transforms: common },
  // WorkflowTemplateDrafts is not relevant
  // { name: 'WorkflowTemplateDrafts', keys: ['id'], transforms: common },
  { name: 'WorkflowDrafts', keys: ['id'], transforms: [...workflowDraftsTransforms, ...common] },
  { name: 'RevokedTokens', keys: ['id'], transforms: common },
  { name: 'Locks', keys: ['id'], transforms: common },
  { name: 'Accounts', keys: ['id'], transforms: common },
  { name: 'UserRoles', keys: ['id'], transforms: common },
  { name: 'AwsAccounts', keys: ['id'], transforms: common },
  { name: 'CostApiCaches', keys: ['indexId', 'query'], transforms: common },
  { name: 'EnvironmentsSc', keys: ['id'], transforms: common },
  { name: 'Indexes', keys: ['id'], transforms: common },
  { name: 'EnvironmentTypes', keys: ['id'], transforms: common },
  { name: 'Environments', keys: ['id'], transforms: [...common, listValue('sharedWithUsers')] },
  { name: 'KeyPairs', keys: ['id'], transforms: [...keyPairsTransforms, ...common] },
  { name: 'Projects', keys: ['id'], transforms: [...common, listValue('projectAdmins')] },
  { name: 'StudyPermissions', keys: ['id'], transforms: [...studyPermissionsTransforms, ...common] },
  { name: 'Studies', keys: ['id'], transforms: common },
];

module.exports = tables;
