const _ = require('lodash');

/**
 * Utility function to collect Docusaurus configuration, by calling each docs plugin in order.
 *
 * @param {getPlugins} pluginRegistry A registry that provides plugins registered by various add-ons for the specified extension point.
 * Each 'docs' plugin in the returned array is an object containing "getConfiguration" method.
 *
 * @returns {Promise<void>}
 */
async function registerDocs(pluginRegistry) {
  // Get all services plugins from the services plugin registry
  // Each plugin is an object with a "getConfiguration" method
  const extensionPoint = 'docs';
  const plugins = await pluginRegistry.getPlugins(extensionPoint);
  if (!_.isArray(plugins)) {
    throw new Error('Expecting plugins to be an array');
  }
  const expectedMethod = 'getConfiguration';
  const pluginsWithoutMethod = _.filter(plugins, (plugin) => !_.isFunction(plugin[expectedMethod]));
  if (pluginsWithoutMethod.length > 0) {
    throw new Error(`All "${extensionPoint}" plugins must implement a "${expectedMethod}" method`);
  }

  // Collect configuration from all plugins.
  //
  // Ask each plugin to contribute to the Docusaurus configuration.
  // Each plugin is passed an object containing Docusaurus configuration of the format:
  //
  // {
  //   pagesPaths: {String[]} - Array of absolute path strings where MDX Markdown pages can be found (see https://v2.docusaurus.io/docs/creating-pages#routing)
  //   staticFilesPaths: {String[]} - Array of absolute path strings where static assets can be found (see https://v2.docusaurus.io/docs/static-assets)
  //   docusaurusConfig: {Object} - Docusaurus configuration object (see https://v2.docusaurus.io/docs/configuration#what-goes-into-a-docusaurusconfigjs)
  //   sidebarsConfig: {Object} - Docusaurus sidebar object (see https://v2.docusaurus.io/docs/docs-introduction/#sidebar-object)
  // }
  //
  // Each plugin may choose to override any of these properties.
  // The plugins are called in the same order as returned by the registry.
  const configMap = await _.reduce(
    plugins,
    async (configSoFarPromise, plugin) => plugin.getConfiguration(await configSoFarPromise, pluginRegistry),
    Promise.resolve({ pagesPaths: [], staticFilesPaths: [], docusaurusConfig: {}, sidebarsConfig: {} }),
  );

  return configMap;
}

module.exports = { registerDocs };
