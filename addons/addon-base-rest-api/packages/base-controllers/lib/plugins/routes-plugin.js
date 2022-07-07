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

// base middlewares
const newSetupAuthContextMiddleware = require('../middlewares/setup-auth-context');
const prepareContextFn = require('../middlewares/prepare-context');
const ensureActiveFn = require('../middlewares/ensure-active');
const ensureAdminFn = require('../middlewares/ensure-admin');
// base controllers
const authenticationProviderController = require('../authentication-provider-controller');
const authenticationProviderPublicController = require('../authentication-provider-public-controller');
const signInController = require('../sign-in-controller');
const signOutController = require('../sign-out-controller');
const usersController = require('../users-controller');
const userController = require('../user-controller');
/**
 * Adds base routes to the given routesMap.
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and an array of functions that configure the router as value. Each function in the
 * array is expected have the following signature. The function accepts context and router
 * arguments and returns a configured router.
 *
 * (context, router) => configured router
 *
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of base routes vs their router configurer functions
 */
// eslint-disable-next-line no-unused-vars
async function getBaseRoutes(routesMap, pluginRegistry) {
  const routes = new Map([
    ...routesMap,
    // PUBLIC APIS - No base middlewares to configure
    ['/api/authentication/id-tokens', [signInController]],
    ['/api/authentication/public/provider/configs', [authenticationProviderPublicController]],

    // PROTECTED APIS accessible only to logged in admin users
    [
      '/api/authentication/provider',
      [
        newSetupAuthContextMiddleware,
        prepareContextFn,
        ensureActiveFn,
        ensureAdminFn,
        authenticationProviderController,
      ],
    ],

    // PROTECTED API accessible to logged in (but not necessarily active) users
    ['/api/authentication/logout', [newSetupAuthContextMiddleware, prepareContextFn, signOutController]],

    // Other PROTECTED APIS accessible only to logged in active users
    ['/api/users', [newSetupAuthContextMiddleware, prepareContextFn, ensureActiveFn, usersController]],
    ['/api/user', [newSetupAuthContextMiddleware, prepareContextFn, ensureActiveFn, userController]],
  ]);

  return routes;
}

const plugin = {
  getRoutes: getBaseRoutes,
};

module.exports = plugin;
