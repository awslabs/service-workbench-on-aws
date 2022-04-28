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

const baseAuditPlugin = require('@amzn/base-services/lib/plugins/audit-plugin');
const baseServicesPlugin = require('@amzn/base-api-handler/lib/plugins/services-plugin');
const baseWfServicesPlugin = require('@amzn/base-workflow-core/lib/runner/plugins/services-plugin');
const baseWfStepsPlugin = require('@amzn/base-workflow-steps/steps/workflow-steps-plugin');
const baseRaasServicesPlugin = require('@amzn/base-raas-rest-api/lib/plugins/services-plugin');
const baseRaasCfnTemplatesPlugin = require('@amzn/base-raas-cfn-templates/dist/plugins/cfn-templates-plugin');
const baseRaasWfStepsPlugin = require('@amzn/base-raas-workflow-steps/lib/plugins/workflow-steps-plugin');
const baseRaasWorkflowsPlugin = require('@amzn/base-raas-workflows/lib/plugins/workflows-plugin');
const baseRaasUserAuthzPlugin = require('@amzn/base-raas-services/lib/user/user-authz-plugin');
const baseRaasSchemaPlugin = require('@amzn/base-raas-services/lib/plugins/schema-plugin');
const environmentTypeServicesPlugin = require('@amzn/environment-type-mgmt-services/lib/plugins/services-plugin');
const keyPairServicesPlugin = require('@amzn/key-pair-mgmt-services/lib/plugins/services-plugin');
const environmentScWfStepsPlugin = require('@amzn/environment-sc-workflow-steps/lib/plugins/workflow-steps-plugin');
const environmentScWfPlugin = require('@amzn/environment-sc-workflows/lib/plugins/workflows-plugin');
const bassRaasEnvTypeVarsPlugin = require('@amzn/base-raas-services/lib/plugins/env-provisioning-plugin');
const rolesOnlyStrategyPlugin = require('@amzn/base-raas-services/lib/plugins/roles-only-strategy-plugin');
const legacyStrategyPlugin = require('@amzn/base-raas-services/lib/plugins/legacy-strategy-plugin');
const baseRaasAppstreamServicesPlugin = require('@amzn/base-raas-appstream-rest-api/lib/plugins/services-plugin');
const baseRaasAppstreamEnvTypeVarsPlugin = require('@amzn/base-raas-appstream-services/lib/plugins/env-sc-provisioning-plugin');

const servicesPlugin = require('services/lib/plugins/services-plugin');

const extensionPoints = {
  'service': [
    baseServicesPlugin,
    baseWfServicesPlugin,
    baseRaasServicesPlugin,
    baseRaasAppstreamServicesPlugin,
    environmentTypeServicesPlugin,
    keyPairServicesPlugin,
    servicesPlugin,
  ],
  'audit': [baseAuditPlugin],
  'workflow-steps': [baseWfStepsPlugin, baseRaasWfStepsPlugin, environmentScWfStepsPlugin],
  'workflow-templates': [],
  'workflows': [baseRaasWorkflowsPlugin, environmentScWfPlugin],
  'workflow-assignments': [],
  'cfn-templates': [baseRaasCfnTemplatesPlugin],
  'env-provisioning': [bassRaasEnvTypeVarsPlugin, baseRaasAppstreamEnvTypeVarsPlugin], // Plugins to participate in resolving list of "Environment Type Configuration Variables". See "addons/addon-environment-sc-api/README.md" to understand what "Environment Type Configuration Variables" are

  // --- Authorization Plugins ---/

  'user-authz': [baseRaasUserAuthzPlugin],
  'user-role-management-authz': [], // No plugins at this point. All user-role-management authz is happening inline in 'user-roles-service'
  'environment-authz': [], // No plugins at this point. All environment authz is happening inline in 'environment-service' using the 'environment-authz-service'
  'project-authz': [], // No plugins at this point. All project authz is happening inline in 'project-service'
  'index-authz': [], // No plugins at this point. All index authz is happening inline in 'index-service'
  'account-authz': [], // No plugins at this point. All account authz is happening inline in 'account-service'
  'aws-account-authz': [], // No plugins at this point. All aws-account authz is happening inline in 'aws-account-service'
  'cost-authz': [], // No plugins at this point. All cost authz is happening inline in 'costs-service'

  'schema': [baseRaasSchemaPlugin],
  'study-access-strategy': [legacyStrategyPlugin, rolesOnlyStrategyPlugin],
};

async function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint];
}

const registry = {
  getPlugins,
};

module.exports = registry;
