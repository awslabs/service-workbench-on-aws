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
const baseWfServicesPlugin = require('@aws-ee/base-workflow-core/lib/runner/plugins/services-plugin');
const baseWfStepsPlugin = require('@aws-ee/base-workflow-steps/steps/workflow-steps-plugin');
const bassRaasServicesPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/services-plugin');
const baseRaasCfnTemplatesPlugin = require('@aws-ee/base-raas-cfn-templates/dist/plugins/cfn-templates-plugin');
const baseRaasWfStepsPlugin = require('@aws-ee/base-raas-workflow-steps/lib/plugins/workflow-steps-plugin');
const baseRaasWorkflowsPlugin = require('@aws-ee/base-raas-workflows/lib/plugins/workflows-plugin');
const baseRaasUserAuthzPlugin = require('@aws-ee/base-raas-services/lib/user/user-authz-plugin');

const servicesPlugin = require('./services-plugin');

const extensionPoints = {
  'service': [baseWfServicesPlugin, bassRaasServicesPlugin, servicesPlugin],
  'audit': [baseAuditPlugin],
  'workflow-steps': [baseWfStepsPlugin, baseRaasWfStepsPlugin],
  'workflow-templates': [],
  'workflows': [baseRaasWorkflowsPlugin],
  'workflow-assignments': [],
  'cfn-templates': [baseRaasCfnTemplatesPlugin],
  'user-authz': [baseRaasUserAuthzPlugin],
  'user-role-management-authz': [], // No plugins at this point. All user-role-management authz is happening inline in 'user-roles-service'
  'environment-authz': [], // No plugins at this point. All environment authz is happening inline in 'environment-service' using the 'environment-authz-service'
  'project-authz': [], // No plugins at this point. All project authz is happening inline in 'project-service'
  'index-authz': [], // No plugins at this point. All index authz is happening inline in 'index-service'
  'account-authz': [], // No plugins at this point. All account authz is happening inline in 'account-service'
  'aws-account-authz': [], // No plugins at this point. All aws-account authz is happening inline in 'aws-account-service'
  'cost-authz': [], // No plugins at this point. All cost authz is happening inline in 'costs-service'
};

async function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint];
}

const registry = {
  getPlugins,
};

module.exports = registry;
