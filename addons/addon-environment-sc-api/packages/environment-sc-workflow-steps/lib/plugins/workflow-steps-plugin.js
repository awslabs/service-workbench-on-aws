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

const readEnvironmentInfo = require('../steps/read-environment-info/read-environment-info');
const readEnvironmentInfoYaml = require('../steps/read-environment-info/read-environment-info.yml');

const replicateLaunchConstraintInTargetAcc = require('../steps/replicate-launch-constraint-in-target-acc/replicate-launch-constraint-in-target-acc');
const replicateLaunchConstraintInTargetAccYaml = require('../steps/replicate-launch-constraint-in-target-acc/replicate-launch-constraint-in-target-acc.yml');

const sharePortfolioWithTargetAcc = require('../steps/share-portfolio-with-target-acc/share-portfolio-with-target-acc');
const sharePortfolioWithTargetAccYaml = require('../steps/share-portfolio-with-target-acc/share-portfolio-with-target-acc.yml');

const launchProduct = require('../steps/launch-product/launch-product');
const launchProductYaml = require('../steps/launch-product/launch-product.yml');

const terminateProduct = require('../steps/terminate-product/terminate-product');
const terminateProductYaml = require('../steps/terminate-product/terminate-product.yml');

const add = (implClass, yaml) => ({ implClass, yaml });

// The order is important, add your steps here
const steps = [
  add(readEnvironmentInfo, readEnvironmentInfoYaml),
  add(replicateLaunchConstraintInTargetAcc, replicateLaunchConstraintInTargetAccYaml),
  add(sharePortfolioWithTargetAcc, sharePortfolioWithTargetAccYaml),
  add(launchProduct, launchProductYaml),
  add(terminateProduct, terminateProductYaml),
];

async function registerWorkflowSteps(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    const { implClass, yaml } = step;
    await registry.add({ implClass, yaml }); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowSteps };
