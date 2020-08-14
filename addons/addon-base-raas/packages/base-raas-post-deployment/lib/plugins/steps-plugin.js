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

const CreateUserRoles = require('../steps/create-user-roles');
const InjectServiceEndpoint = require('../steps/inject-service-endpoint');
const CreateCloudFrontInterceptor = require('../steps/create-cloudfront-interceptor');
const CreateServiceCatalogPortfolio = require('../steps/create-service-catalog-portfolio');
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
    // The userService implementation of RaaS requires the roles to be created first before a user can be created
    // One of the steps from the "existingStepsMap" tries to create root user.
    // Make sure the CreateUserRoles gets executed first before executing other post deployment steps otherwise the root
    // user creation step will fail
    ['createUserRoles', new CreateUserRoles()],
    ...existingStepsMap,
    ['injectServiceEndpoint', new InjectServiceEndpoint()],
    ['createCloudFrontInterceptor', new CreateCloudFrontInterceptor()],
    ['createServiceCatalogPortfolio', new CreateServiceCatalogPortfolio()],
  ]);

  return stepsMap;
}

const plugin = {
  getSteps,
};

module.exports = plugin;
