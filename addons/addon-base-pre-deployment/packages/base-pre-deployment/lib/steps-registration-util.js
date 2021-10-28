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

const _ = require('lodash');

/**
 * Utility function to register pre-deployment steps by calling each pre-deployment step registration plugin in order.
 *
 * @param {*} container An instance of ServicesContainer
 * @param {getPlugins} pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 * Each 'preDeploymentStep' plugin in the returned array is an object containing "getSteps" method.
 *
 * @returns {Promise<Map<String, Service>>}
 */
async function registerSteps(container, pluginRegistry) {
  const plugins = await pluginRegistry.getPlugins('preDeploymentStep');

  // 1. Collect steps from all plugins
  //
  // Ask each plugin to return their steps. Each plugin is passed a Map containing the pre deployment steps collected
  // so far from other plugins. The plugins are called in the same order as returned by the registry.
  // Each plugin gets a chance to add, remove, update, or delete steps by mutating the provided stepsMap object.
  // This stepsMap is a Map that has step service names as keys and an instance of step implementation service containing
  // "execute" method as value.
  //
  const stepsMap = await _.reduce(
    plugins,
    async (stepsSoFarPromise, plugin) => plugin.getSteps(await stepsSoFarPromise, pluginRegistry),
    Promise.resolve(new Map()),
  );

  // 2. Register all steps to the container
  stepsMap.forEach((stepService, stepName) => {
    container.register(stepName, stepService);
  });

  return stepsMap;
}

module.exports = { registerSteps };
