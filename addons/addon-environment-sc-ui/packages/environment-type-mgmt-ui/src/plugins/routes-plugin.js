import withAuth from '@aws-ee/base-ui/dist/withAuth';

import _ from 'lodash';
import EnvTypesManagement from '../parts/environment-types/EnvTypesManagement';
import EnvTypeEditor from '../parts/environment-types/EnvTypeEditor';

/**
 * Adds routes to the given routesMap.
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and React Component as value.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of base routes vs React Component
 */
// eslint-disable-next-line no-unused-vars
function registerRoutes(routesMap, { location, appContext }) {
  const showEnvTypeManagement = _.get(appContext, 'showEnvTypeManagement', true);
  if (showEnvTypeManagement) {
    const routes = new Map([
      ...routesMap,
      ['/workspace-types-management/:action/:id', withAuth(EnvTypeEditor)],
      ['/workspace-types-management', withAuth(EnvTypesManagement)],
    ]);
    return routes;
  }
  return routesMap;
}

const plugin = {
  registerRoutes,
};

export default plugin;
