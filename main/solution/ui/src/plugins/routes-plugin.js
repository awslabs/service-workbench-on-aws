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

  // TODO: Register additional routes and their React Components as per your solution requirements

  // DO NOT forget to return routes here. If you do not return here, no routes will be configured in React router
  return routesMap;
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
