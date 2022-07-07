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

import React from 'react';
import _ from 'lodash';
import { Route, Switch } from 'react-router-dom';

/**
 * Configures the given React Router by collecting routes contributed by all route plugins.
 *
 * @returns {*} A React.Router or Switch Component
 */
// eslint-disable-next-line no-unused-vars
function getRoutes({ location, appContext }) {
  const plugins = appContext.pluginRegistry.getPluginsWithMethod('routes', 'registerRoutes');
  const initial = new Map();
  // Ask each plugin to return their routes. Each plugin is passed a Map containing the routes collected so
  // far from other plugins. The plugins are called in the same order as returned by the registry.
  // Each plugin gets a chance to add, remove, update, or delete routes by mutating the provided routesMap object.
  // This routesMap is a Map that has route paths as keys and React Component as value.
  const routesMap = _.reduce(plugins, (routesFar, plugin) => plugin.registerRoutes(routesFar, appContext), initial);

  const entries = Array.from(routesMap || new Map());
  let routeIdx = 0;
  return (
    <Switch>
      {_.map(entries, ([routePath, reactComponent]) => {
        routeIdx += 1;
        return <Route key={routeIdx} path={routePath} component={reactComponent} />;
      })}
    </Switch>
  );
}

/**
 * Returns menu items for navigation by collecting items contributed by all menu item plugins.
 *
 * @param {*} appContext An application context object containing all MobX store objects
 *
 * @returns {*}
 */
function getMenuItems({ location, appContext }) {
  const plugins = appContext.pluginRegistry.getPluginsWithMethod('menu-items', 'registerMenuItems');
  const initial = new Map();
  // Ask each plugin to return their nav items. Each plugin is passed a Map containing the nav items collected so
  // far from other plugins. The plugins are called in the same order as returned by the registry.
  // Each plugin gets a chance to add, remove, update, or delete items by mutating the provided itemsMap object.
  // This itemsMap is a Map that has route paths (urls) as keys and menu item object as values.
  const itemsMap = _.reduce(
    plugins,
    (itemsSoFar, plugin) => plugin.registerMenuItems(itemsSoFar, { location, appContext }),
    initial,
  );

  const entries = Array.from(itemsMap || new Map());
  return _.map(entries, ([url, menuItem]) => ({ url, ...menuItem }));
}

function getDefaultRouteLocation({ location, appContext }) {
  const plugins = _.reverse(appContext.pluginRegistry.getPluginsWithMethod('routes', 'getDefaultRouteLocation') || []);
  // We ask each plugin in reverse order if they have a default route
  let defaultRoute;
  _.forEach(plugins, plugin => {
    const result = plugin.getDefaultRouteLocation({ location, appContext });
    if (_.isUndefined(result)) return;
    defaultRoute = result;
    // eslint-disable-next-line consistent-return
    return false; // This will stop lodash from continuing the forEach loop
  });

  return defaultRoute;
}

export { getRoutes, getMenuItems, getDefaultRouteLocation };
