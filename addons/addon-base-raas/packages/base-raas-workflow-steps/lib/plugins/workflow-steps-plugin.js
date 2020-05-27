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

const add = (implClass, yaml) => ({ implClass, yaml });

// The order is important, add your steps here
const steps = [
  add(deleteEnvironment, deleteEnvironmentYaml),
  add(provisionAccount, provisionAccountYaml),
  add(provisionEnvironment, provisionEnvironmentYaml),
];

async function registerWorkflowSteps(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    const { implClass, yaml } = step;
    await registry.add({ implClass, yaml }); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowSteps };
