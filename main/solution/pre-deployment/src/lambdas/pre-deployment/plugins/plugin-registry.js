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

const baseServicesPlugin = require('@aws-ee/base-pre-deployment/lib/plugins/services-plugin');
const baseStepsPlugin = require('@aws-ee/base-pre-deployment/lib/plugins/steps-plugin');
const workflowServicesPlugin = require('@aws-ee/base-workflow-core/lib/runner/plugins/services-plugin');
const baseRaasServicesPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/services-plugin');
const environmentTypeServicesPlugin = require('@aws-ee/environment-type-mgmt-services/lib/plugins/services-plugin');
const keyPairServicesPlugin = require('@aws-ee/key-pair-mgmt-services/lib/plugins/services-plugin');

const servicesPlugin = require('./services-plugin');
const stepsPlugin = require('./steps-plugin');

const extensionPoints = {
  service: [
    baseServicesPlugin,
    workflowServicesPlugin,
    baseRaasServicesPlugin,
    environmentTypeServicesPlugin,
    keyPairServicesPlugin,
    servicesPlugin,
  ],
  preDeploymentStep: [baseStepsPlugin, stepsPlugin],
};

async function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint];
}

const registry = {
  getPlugins,
};

module.exports = registry;
