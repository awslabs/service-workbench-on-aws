import _ from 'lodash';

import Dashboard from '../parts/dashboard/Dashboard';
import AddAuthenticationProvider from '../parts/authentication-providers/AddAuthenticationProvider';
import EditAuthenticationProvider from '../parts/authentication-providers/EditAuthenticationProvider';
import AuthenticationProvidersList from '../parts/authentication-providers/AuthenticationProvidersList';
import ApiKeysList from '../parts/api-keys/ApiKeysList';
import AddUser from '../parts/users/AddUser';
import UsersList from '../parts/users/UsersList';
import withAuth from '../withAuth';

/**
 * Adds base routes to the given routesMap.
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and React Component as value.
 * @param appContext An application context object containing various Mobx Stores, Models etc.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of base routes vs React Component
 */
// eslint-disable-next-line no-unused-vars
function registerRoutes(routesMap, { location, appContext }) {
  const routes = new Map([
    ...routesMap,
    ['/authentication-providers/add', withAuth(AddAuthenticationProvider)],
    ['/authentication-providers/:authenticationProviderConfigId/edit', withAuth(EditAuthenticationProvider)],
    ['/authentication-providers', withAuth(AuthenticationProvidersList)],
    ['/api-keys', withAuth(ApiKeysList)],
    ['/users/add', withAuth(AddUser)],
    ['/users', withAuth(UsersList)],
    ['/dashboard', withAuth(Dashboard)],
  ]);

  return routes;
}

/**
 * Returns default route. By default this method returns the
 * '/dashboard' route as the default route for all non-root users and returns
 * '/users' route for root user.
 * @returns {{search: *, state: *, hash: *, pathname: string}}
 */
function getDefaultRouteLocation({ location, appContext }) {
  const userStore = appContext.userStore;
  // See https://reacttraining.com/react-router/web/api/withRouter
  const isRootUser = _.get(userStore, 'user.isRootUser');
  const defaultLocation = {
    pathname: isRootUser ? '/users' : '/dashboard',
    search: location.search, // we want to keep any query parameters
    hash: location.hash,
    state: location.state,
  };

  return defaultLocation;
}

const plugin = {
  registerRoutes,
  getDefaultRouteLocation,
};

export default plugin;
