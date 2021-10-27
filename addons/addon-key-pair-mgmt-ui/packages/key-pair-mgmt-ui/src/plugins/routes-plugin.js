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
