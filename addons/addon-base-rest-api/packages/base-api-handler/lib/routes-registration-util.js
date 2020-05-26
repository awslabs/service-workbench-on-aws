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
 * Configures the given express router by collecting routes contributed by all route plugins.
 * @param {*} context An instance of AppContext from api-handler-factory
 * @param {*} router Top level Express router
 * @param {getPlugins} pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 * Each 'route' plugin in the returned array is an object containing "getRoutes" method.
 *
 * @returns {Promise<unknown[]>}
 */
async function registerRoutes(context, router, pluginRegistry) {
  // Get all routes plugins from the routes plugin registry
  // Each plugin is an object containing "getRoutes" method
  const plugins = await pluginRegistry.getPlugins('route');

  const initialRoutes = new Map();
  // Ask each plugin to return their routes. Each plugin is passed a Map containing the routes collected so
  // far from other plugins. The plugins are called in the same order as returned by the registry.
  // Each plugin gets a chance to add, remove, update, or delete routes by mutating the provided routesMap object.
  // This routesMap is a Map that has route paths as keys and an array of functions that configure the router as value.
  // Each function in the array is expected have the following signature. The function accepts context and router
  // arguments and returns a configured router.
  //
  // (context, router) => configured router
  //
  const routesMap = await _.reduce(
    plugins,
    async (routesSoFarPromise, plugin) => plugin.getRoutes(await routesSoFarPromise, pluginRegistry),
    Promise.resolve(initialRoutes),
  );

  const configuredRoutes = [];
  const entries = Array.from(routesMap || new Map());
  // Register routes to the parent level express "router" and call each function from the routes configuration
  // functions to give them a chance to configure their routes by either adding routes directly to the parent router
  // or by returning a child router
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const [routePath, routerConfigurers] = entry;
    for (let j = 0; j < routerConfigurers.length; j += 1) {
      const configurerFn = routerConfigurers[j];
      // Need to await configurerFn in sequence so awaiting in loop
      // eslint-disable-next-line no-await-in-loop
      const childRouter = await configurerFn(context, router);
      // The router configurer function may create a child router.
      // In that case, configure the child router on the parent router.
      // If the function does not return a router then assume it configured
      // the route directly on the parent router given to it
      if (childRouter) {
        router.use(routePath, childRouter);
      }
      configuredRoutes.push(routePath);
    }
  }
  return configuredRoutes;
}

module.exports = { registerRoutes };
