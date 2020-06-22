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

const emptyWorkflowYaml = require('./empty-workflow.yml');

const add = yaml => ({ yaml });

// The order is important, add your templates here
const templates = [add(emptyWorkflowYaml)];

async function registerWorkflowTemplates(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const template of templates) {
    await registry.add(template); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowTemplates };
