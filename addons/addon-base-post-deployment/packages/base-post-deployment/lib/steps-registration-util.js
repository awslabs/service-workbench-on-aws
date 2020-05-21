const _ = require('lodash');

/**
 * Utility function to register post-deployment steps by calling each post-deployment step registration plugin in order.
 *
 * @param {*} container An instance of ServicesContainer
 * @param {getPlugins} pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 * Each 'postDeploymentStep' plugin in the returned array is an object containing "getSteps" method.
 *
 * @returns {Promise<Map<String, Service>>}
 */
async function registerSteps(container, pluginRegistry) {
  const plugins = await pluginRegistry.getPlugins('postDeploymentStep');

  // 1. Collect steps from all plugins
  //
  // Ask each plugin to return their steps. Each plugin is passed a Map containing the post deployment steps collected
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
