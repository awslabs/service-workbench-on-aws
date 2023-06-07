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

const CreateRootUserService = require('../steps/create-root-user-service');
const AddAuthProviders = require('../steps/add-auth-providers');
const CreateJwtKeyService = require('../steps/create-jwt-key-service');

/**
 * Returns a map of post deployment steps
 *
 * @param existingStepsMap Map of existing post deployment steps
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>}
 */
// eslint-disable-next-line no-unused-vars
async function getSteps(existingStepsMap, pluginRegistry) {
  const stepsMap = new Map([
    ...existingStepsMap,
    ['createJwtKeyService', new CreateJwtKeyService()],
    ['addAuthProviders', new AddAuthProviders()],
    ['createRootUser', new CreateRootUserService()],
  ]);

  return stepsMap;
}

const plugin = {
  getSteps,
};

module.exports = plugin;
