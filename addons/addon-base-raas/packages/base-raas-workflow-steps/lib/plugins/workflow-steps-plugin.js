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

/* eslint-disable global-require */
const deleteEnvironment = require('../steps/delete-environment/delete-environment');
const deleteEnvironmentYaml = require('../steps/delete-environment/delete-environment.yml');
const provisionAccount = require('../steps/provision-account/provision-account');
const provisionAccountYaml = require('../steps/provision-account/provision-account.yml');
const provisionEnvironment = require('../steps/provision-environment/provision-environment');
const provisionEnvironmentYaml = require('../steps/provision-environment/provision-environment.yml');
const startSageMakerEnvironment = require('../steps/start-sagemaker-environment/start-sagemaker-environment');
const startSageMakerEnvironmentYaml = require('../steps/start-sagemaker-environment/start-sagemaker-environment.yml');
const stopSageMakerEnvironment = require('../steps/stop-sagemaker-environment/stop-sagemaker-environment');
const stopSageMakerEnvironmentYaml = require('../steps/stop-sagemaker-environment/stop-sagemaker-environment.yml');
const startEC2Environment = require('../steps/start-ec2-environment/start-ec2-environment');
const startEC2EnvironmentYaml = require('../steps/start-ec2-environment/start-ec2-environment.yml');
const stopEC2Environment = require('../steps/stop-ec2-environment/stop-ec2-environment');
const stopEC2EnvironmentYaml = require('../steps/stop-ec2-environment/stop-ec2-environment.yml');
const networkInfra = require('../steps/storage-gateway/create-network-infrastructure');
const networkInfraYaml = require('../steps/storage-gateway/create-network-infrastructure.yml');
const bulkReachability = require('../steps/bulk-reachability-check/bulk-reachability-check');
const bulkReachabilityYaml = require('../steps/bulk-reachability-check/bulk-reachability-check.yml');
const dsAccountStatusChange = require('../steps/ds-account-status-change/ds-account-status-change');
const dsAccountStatusChangeYaml = require('../steps/ds-account-status-change/ds-account-status-change.yml');

const add = (implClass, yaml) => ({ implClass, yaml });

// The order is important, add your steps here
const steps = [
  add(deleteEnvironment, deleteEnvironmentYaml),
  add(provisionAccount, provisionAccountYaml),
  add(provisionEnvironment, provisionEnvironmentYaml),
  add(startSageMakerEnvironment, startSageMakerEnvironmentYaml),
  add(stopSageMakerEnvironment, stopSageMakerEnvironmentYaml),
  add(startEC2Environment, startEC2EnvironmentYaml),
  add(stopEC2Environment, stopEC2EnvironmentYaml),
  add(networkInfra, networkInfraYaml),
  add(bulkReachability, bulkReachabilityYaml),
  add(dsAccountStatusChange, dsAccountStatusChangeYaml),
];

async function registerWorkflowSteps(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    const { implClass, yaml } = step;
    await registry.add({ implClass, yaml }); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowSteps };
