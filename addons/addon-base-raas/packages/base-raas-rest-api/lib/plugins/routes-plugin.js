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
const setupAuthContext = require('@aws-ee/base-controllers/lib/middlewares/setup-auth-context');
const prepareContext = require('@aws-ee/base-controllers/lib/middlewares/prepare-context');
const ensureActive = require('@aws-ee/base-controllers/lib/middlewares/ensure-active');
const ensureAdmin = require('@aws-ee/base-controllers/lib/middlewares/ensure-admin');
const userController = require('@aws-ee/base-controllers/lib/user-controller');

const usersController = require('../controllers/users-controller');
const studyController = require('../controllers/study-controller');
const environmentController = require('../controllers/environment-controller');
const environmentScController = require('../controllers/environment-sc-controller');
const userRolesController = require('../controllers/user-roles-controller');
const awsAccountsController = require('../controllers/aws-accounts-controller');
const costsController = require('../controllers/costs-controller');
const indexesController = require('../controllers/indexes-controller');
const projectController = require('../controllers/project-controller');
const accountsController = require('../controllers/accounts-controller');
const templateController = require('../controllers/template-controller');
const computeController = require('../controllers/compute-controller');
const ipController = require('../controllers/ip-controller');
const budgetsController = require('../controllers/budgets-controller');
const dataSourceController = require('../controllers/data-source-controller');

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
  // PROTECTED APIS for workflows accessible only to logged in ADMIN users. These routes are already registered by
  // the workflow's api plugin (addons/addon-base-workflow-api/packages/base-worklfow-api/lib/plugins/routes-plugin.js)
  // but are made available to all users.
  // For Service Workbench, we want these APIs to be ONLY available to admin users. So append ensureAdmin middleware to existing
  // routes middlewares
  appendMiddleware(routesMap, '/api/step-templates', ensureAdmin);
  appendMiddleware(routesMap, '/api/workflow-templates', ensureAdmin);
  appendMiddleware(routesMap, '/api/workflows', ensureAdmin);

  const routes = new Map([
    ...routesMap,
    // PROTECTED APIS accessible only to logged in users
    ['/api/user', [setupAuthContext, prepareContext, userController]],

    // PROTECTED APIS accessible only to logged in active users
    ['/api/users', [setupAuthContext, prepareContext, ensureActive, usersController]],
    ['/api/studies', [setupAuthContext, prepareContext, ensureActive, studyController]],
    ['/api/workspaces/built-in', [setupAuthContext, prepareContext, ensureActive, environmentController]],
    ['/api/workspaces/service-catalog', [setupAuthContext, prepareContext, ensureActive, environmentScController]],
    ['/api/user-roles', [setupAuthContext, prepareContext, ensureActive, userRolesController]],
    ['/api/aws-accounts', [setupAuthContext, prepareContext, ensureActive, awsAccountsController]],
    ['/api/costs', [setupAuthContext, prepareContext, ensureActive, costsController]],
    ['/api/indexes', [setupAuthContext, prepareContext, ensureActive, indexesController]],
    ['/api/projects', [setupAuthContext, prepareContext, ensureActive, projectController]],
    ['/api/template', [setupAuthContext, prepareContext, ensureActive, templateController]],
    ['/api/compute', [setupAuthContext, prepareContext, ensureActive, computeController]],
    ['/api/ip', [setupAuthContext, prepareContext, ensureActive, ipController]],

    // PROTECTED APIS accessible only to logged in active, admin users
    ['/api/accounts', [setupAuthContext, prepareContext, ensureActive, ensureAdmin, accountsController]],
    ['/api/budgets', [setupAuthContext, prepareContext, ensureActive, ensureAdmin, budgetsController]],
    ['/api/data-sources', [setupAuthContext, prepareContext, ensureActive, ensureAdmin, dataSourceController]],
  ]);
  return routes;
}

/**
 * A private utility function to append a middleware function for an existing route in the specified routesMap.
 *
 * For example, if the specified route has existing middlewares as [middleware1, middleware2, controller] and if
 * middleware to append is "middleware3" then this function will modify the specified route as
 * [middleware1, middleware2, middleware3, controller]
 *
 * @param routesMap
 * @param route
 * @param middleware
 * @returns {*}
 */
function appendMiddleware(routesMap, route, middleware) {
  // the existingMiddlewares is expected to be an array in [middleware1, middleware2, controler] form
  const existingMiddlewares = routesMap.get(route);

  if (!existingMiddlewares) {
    throw new Error(`Cannot append a middleware no route found for path "${route}"`);
  }
  if (_.isEmpty(existingMiddlewares)) {
    throw new Error(
      `Cannot append a middleware. The route "${route}" needs to contain at least one controller function`,
    );
  }
  const updatedMiddlewares = [
    ...existingMiddlewares.slice(0, existingMiddlewares.length - 1),
    middleware,
    existingMiddlewares[existingMiddlewares.length - 1],
  ];
  routesMap.set(route, updatedMiddlewares);
  return routesMap;
}

const plugin = {
  getRoutes,
};

module.exports = plugin;
