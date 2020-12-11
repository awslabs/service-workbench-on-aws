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

const createEnvironmentYaml = require('../workflows/create-environment.yml');
const deleteEnvironmentYaml = require('../workflows/delete-environment.yml');
const provisionAccountYaml = require('../workflows/provision-account.yml');
const startSageMakerYaml = require('../workflows/start-sagemaker-environment.yml');
const stopSageMakerYaml = require('../workflows/stop-sagemaker-environment.yml');
const startEC2Yaml = require('../workflows/start-ec2-environment.yml');
const stopEC2Yaml = require('../workflows/stop-ec2-environment.yml');
const networkInfraYaml = require('../workflows/create-network-infra.yml');
const bulkReachabilityCheck = require('../workflows/bulk-reachability-check.yml');
const dsAccountStatusChange = require('../workflows/ds-account-status-change.yml');

const add = yaml => ({ yaml });

// The order is important, add your templates here
const workflows = [
  add(createEnvironmentYaml),
  add(deleteEnvironmentYaml),
  add(provisionAccountYaml),
  add(startSageMakerYaml),
  add(stopSageMakerYaml),
  add(startEC2Yaml),
  add(stopEC2Yaml),
  add(networkInfraYaml),
  add(bulkReachabilityCheck),
  add(dsAccountStatusChange),
];

async function registerWorkflows(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const workflow of workflows) {
    await registry.add(workflow); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflows };
