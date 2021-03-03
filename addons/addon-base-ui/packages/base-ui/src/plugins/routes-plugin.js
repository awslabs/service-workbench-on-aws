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

import _ from 'lodash';

import Dashboard from '../parts/dashboard/Dashboard';
import AddAuthenticationProvider from '../parts/authentication-providers/AddAuthenticationProvider';
import EditAuthenticationProvider from '../parts/authentication-providers/EditAuthenticationProvider';
import AuthenticationProvidersList from '../parts/authentication-providers/AuthenticationProvidersList';
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
