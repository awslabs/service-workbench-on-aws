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

const baseAuditPlugin = require('@aws-ee/base-services/lib/plugins/audit-plugin');
const baseServicesPlugin = require('@aws-ee/base-api-handler/lib/plugins/services-plugin');
const baseRoutesPlugin = require('@aws-ee/base-controllers/lib/plugins/routes-plugin');
const baseWfServicesPlugin = require('@aws-ee/base-workflow-api/lib/plugins/services-plugin');
const baseWfRoutesPlugin = require('@aws-ee/base-workflow-api/lib/plugins/routes-plugin');
const bassRaasServicesPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/services-plugin');
const baseRaasRoutesPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/routes-plugin');
const baseRaasCfnTemplatesPlugin = require('@aws-ee/base-raas-cfn-templates/dist/plugins/cfn-templates-plugin');
const baseRaasUserAuthzPlugin = require('@aws-ee/base-raas-services/lib/user/user-authz-plugin');
const environmentTypeRoutesPlugin = require('@aws-ee/environment-type-mgmt-api/lib/plugins/routes-plugin');
const environmentTypeServicesPlugin = require('@aws-ee/environment-type-mgmt-services/lib/plugins/services-plugin');
const servicesPlugin = require('services/lib/plugins/services-plugin');
const baseRaasSchemaPlugin = require('@aws-ee/base-raas-services/lib/plugins/schema-plugin');
const bassRaasEnvTypeVarsPlugin = require('@aws-ee/base-raas-services/lib/plugins/env-provisioning-plugin');
const keyPairRoutesPlugin = require('@aws-ee/key-pair-mgmt-api/lib/plugins/routes-plugin');
const keyPairServicesPlugin = require('@aws-ee/key-pair-mgmt-services/lib/plugins/services-plugin');
const rolesOnlyStrategyPlugin = require('@aws-ee/base-raas-services/lib/plugins/roles-only-strategy-plugin');
const legacyStrategyPlugin = require('@aws-ee/base-raas-services/lib/plugins/legacy-strategy-plugin');

const routesPlugin = require('./routes-plugin');

const extensionPoints = {
  'service': [
    baseServicesPlugin,
    baseWfServicesPlugin,
    bassRaasServicesPlugin,
    environmentTypeServicesPlugin,
    keyPairServicesPlugin,
    servicesPlugin,
  ],
  'route': [
    baseRoutesPlugin,
    baseWfRoutesPlugin,
    baseRaasRoutesPlugin,
    environmentTypeRoutesPlugin,
    keyPairRoutesPlugin,
    routesPlugin,
  ],
  'audit': [baseAuditPlugin],
  'authentication-provider-type': [], // No plugins at this point. The built in authentication provider types are registered by "addon-base-rest-api/packages/services/lib/authentication-providers/authentication-provider-type-service.js" service
  'cfn-templates': [baseRaasCfnTemplatesPlugin],
  'env-provisioning': [bassRaasEnvTypeVarsPlugin], // Plugins to participate in providing list of "Environment Type Configuration Variables". See "addons/addon-environment-sc-api/README.md" to understand what "Environment Type Configuration Variables" are

  'user-authz': [baseRaasUserAuthzPlugin],
  'user-role-management-authz': [], // No plugins at this point. All user-role-management authz is happening inline in 'user-roles-service'
  'environment-authz': [], // No plugins at this point. All environment authz is happening inline in 'environment-service' using the 'environment-authz-service'
  'project-authz': [], // No plugins at this point. All project authz is happening inline in 'project-service'
  'index-authz': [], // No plugins at this point. All index authz is happening inline in 'index-service'
  'account-authz': [], // No plugins at this point. All account authz is happening inline in 'account-service'
  'aws-account-authz': [], // No plugins at this point. All aws-account authz is happening inline in 'aws-account-service'
  'cost-authz': [], // No plugins at this point. All cost authz is happening inline in 'costs-service'
  'approval-authz': [], // No plugins at this point. All approval authz is happening inline in 'approval-service'

  'schema': [baseRaasSchemaPlugin],
  'env-sc-connection-url': [],
  'study-access-strategy': [legacyStrategyPlugin, rolesOnlyStrategyPlugin],
};

async function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint];
}

const registry = {
  getPlugins,
};

module.exports = registry;
