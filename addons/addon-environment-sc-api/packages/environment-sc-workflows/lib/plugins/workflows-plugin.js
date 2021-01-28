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

const provisionEnvironmentScYaml = require('../workflows/provision-environment-sc.yml');
const startEC2ScYaml = require('../workflows/start-ec2-environment-sc.yml');
const stopEC2ScYaml = require('../workflows/stop-ec2-environment-sc.yml');
const startRStudioScYaml = require('../workflows/start-rstudio-environment-sc.yml');
const stopRStudioScYaml = require('../workflows/stop-rstudio-environment-sc.yml');
const startSageMakerScYaml = require('../workflows/start-sagemaker-environment-sc.yml');
const stopSageMakerScYaml = require('../workflows/stop-sagemaker-environment-sc.yml');
const terminateEnvironmentScYaml = require('../workflows/terminate-environment-sc.yml');

const add = yaml => ({ yaml });

// The order is important, add your templates here
const workflows = [
  add(provisionEnvironmentScYaml),
  add(startEC2ScYaml),
  add(stopEC2ScYaml),
  add(startRStudioScYaml),
  add(stopRStudioScYaml),
  add(startSageMakerScYaml),
  add(stopSageMakerScYaml),
  add(terminateEnvironmentScYaml),
];

async function registerWorkflows(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const workflow of workflows) {
    await registry.add(workflow); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflows };
