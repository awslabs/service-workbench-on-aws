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

import withAuth from '@aws-ee/base-ui/dist/withAuth';

import HelloPage from '../parts/hello/HelloPage';

/**
 * Adds your routes to the given routesMap.
 * This function is called last after adding routes to the routesMap from all other installed addons.
 *
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and React Component as value.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of routes as keys and their React Component as values
 */
// eslint-disable-next-line no-unused-vars
function registerRoutes(routesMap, { location, appContext }) {
  // This is where you can
  // 1. register your routes, to register your routes
  //
  //       const routes = new Map([
  //          ...routesMap,
  //          // Add your routes here
  //          ['/your/routes', SomeReactComponent],
  //       ]);
  //       return routes;
  //
  // 2. modify any existing routes
  //
  //       routesMap.set('the/route/you/want/to/replace',SomeReactComponent);
  //       return routesMap;
  //
  // 3. delete any existing route, to delete existing route
  //
  //      routesMap.delete('the/route/you/want/to/delete');
  //

  // Register additional routes and their React Components as per your solution requirements

  const routes = new Map([...routesMap, ['/hello', withAuth(HelloPage)]]);

  // DO NOT forget to return routes here. If you do not return here, no routes will be configured in React router
  return routes;
}

// eslint-disable-next-line no-unused-vars
function getDefaultRouteLocation({ location, appContext }) {
  // If you want to override the default route location, do it here
}

const plugin = {
  registerRoutes,
  getDefaultRouteLocation,
};

export default plugin;
