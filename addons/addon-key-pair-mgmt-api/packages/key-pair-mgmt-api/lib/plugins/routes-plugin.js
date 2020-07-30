const setupAuthContext = require('@aws-ee/base-controllers/lib/middlewares/setup-auth-context');
const prepareContext = require('@aws-ee/base-controllers/lib/middlewares/prepare-context');
const ensureActive = require('@aws-ee/base-controllers/lib/middlewares/ensure-active');

const keyPairController = require('../controllers/key-pair-controller');

/**
 * Adds routes to the given routesMap.
 *
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and an array of functions that configure the router as value. Each function in the
 * array is expected have the following signature. The function accepts context and router
 * arguments and returns a configured router.
 *
 * (context, router) => configured router
 *
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of the routes vs their router configurer functions
 */
// eslint-disable-next-line no-unused-vars
async function getRoutes(routesMap, pluginRegistry) {
  const routes = new Map([
    ...routesMap,
    // PROTECTED APIS accessible only to logged in active users
    ['/api/key-pairs', [setupAuthContext, prepareContext, ensureActive, keyPairController]],
  ]);
  return routes;
}
const plugin = {
  getRoutes,
};

module.exports = plugin;
