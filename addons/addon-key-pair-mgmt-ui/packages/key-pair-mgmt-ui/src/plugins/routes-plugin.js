import withAuth from '@aws-ee/base-ui/dist/withAuth';

import KeyPairsList from '../parts/key-pairs/KeyPairsList';
import KeyPairCreate from '../parts/key-pairs/KeyPairCreate';
/**
 * Adds routes to the given routesMap.
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and React Component as value.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of base routes vs React Component
 */
// eslint-disable-next-line no-unused-vars
function registerRoutes(routesMap, { location, appContext }) {
  const routes = new Map([
    ...routesMap,
    ['/key-pair-management/create', withAuth(KeyPairCreate)],
    ['/key-pair-management', withAuth(KeyPairsList)],
  ]);
  return routes;
}

const plugin = {
  registerRoutes,
};

export default plugin;
