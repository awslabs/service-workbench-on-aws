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

/**
 * Adds routes to the given routesMap.
 * This function is called last after adding routes to the routesMap from all other installed addons.
 *
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and an array of functions that configure the router as value.
 *
 * Each function in the array is expected have the following signature. The function accepts context and router
 * arguments and returns a configured router.
 *
 * (context, router) => configured router
 *
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of routes as keys and their router configurer functions array as values
 */
// eslint-disable-next-line no-unused-vars
async function getRoutes(routesMap, pluginRegistry) {
  // This is where you can
  // 1. register your routes, to register your routes
  //
  //       const routes = new Map([
  //          ...routesMap,
  //          // Add your routes here
  //          ['/your/routes', [ someMiddlewareFn1, someMiddlewareFn2, ..., someControllerFn ]],
  //       ]);
  //       return routes;
  //
  // 2. modify any existing routes
  //    2.1 by completely replacing them, to replace a route
  //
  //       routesMap.set('the/route/you/want/to/replace',[ comma separated list of middleware functions, some controller function ]);
  //       return routesMap;
  //
  //    2.2 by updating their middlewares or controllers, to update middlewares or controllers of existing routes
  //
  //       const existingMiddlewares = routesMap.get('the/route/whose/middlewares/or/controllers/to/modify');
  //        // Manipulate existingMiddlewares containing middleware and controller functions as per your need
  //       routesMap.set('the/route/whose/middlewares/or/controllers/to/modify',updatedMiddlewareFunctions);
  //       return routesMap;
  //
  // 3. delete any existing route, to delete existing route
  //
  //      routesMap.delete('the/route/you/want/to/delete');
  //

  // TODO: Register additional routes and their controllers as per your solution requirements

  // DO NOT forget to return routesMap here. If you do not return here no routes will be configured in Express router
  return routesMap;
}

const plugin = {
  getRoutes,
};

module.exports = plugin;
