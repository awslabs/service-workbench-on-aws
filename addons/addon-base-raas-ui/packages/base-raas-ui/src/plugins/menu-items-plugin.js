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
/**
 * Adds navigation menu items to the given itemsMap.
 *
 * @param itemsMap A Map containing navigation items. This object is a Map that has route paths (urls) as
 * keys and menu item object with the following shape
 *
 *   {
 *    title: STRING, // Title for the navigation menu item
 *    icon: STRING, // semantic ui icon name fot the navigation menu item
 *    shouldShow: BOOLEAN || FUNCTION, // A flag or a function that returns a flag indicating whether to show the item or not (useful when showing menu items conditionally)
 *    render: OPTIONAL FUNCTION, // Optional function that returns rendered menu item component. Use this ONLY if you want to control full rendering of the menu item.
 *   }
 *
 * @param context A context object containing all various stores
 *
 * @returns Map<*> Returns A Map containing navigation menu items with the same shape as "itemsMap"
 */
// eslint-disable-next-line no-unused-vars
function registerMenuItems(itemsMap, { location, appContext }) {
  const isAdmin = _.get(appContext, 'userStore.user.isAdmin');
  const canCreateWorkspaces = _.get(appContext, 'userStore.user.capabilities.canCreateWorkspace');
  const canViewDashboard = _.get(appContext, 'userStore.user.capabilities.canViewDashboard');
  const dataSources = (
    <span>
      Data
      <br />
      Sources
    </span>
  );
  const items = new Map([
    ..._.filter([...itemsMap], item => {
      if (item[0] === '/dashboard' && !canViewDashboard) return false;
      return true;
    }),
    ['/data-sources', { title: dataSources, icon: 'database', shouldShow: isAdmin }],
    ['/accounts', { title: 'Accounts', icon: 'sitemap', shouldShow: isAdmin }],
    ['/studies', { title: 'Studies', icon: 'book', shouldShow: true }],
    ['/workspaces', { title: 'Workspaces', icon: 'server', shouldShow: canCreateWorkspaces }],
  ]);

  return items;
}
const plugin = {
  registerMenuItems,
};
export default plugin;
