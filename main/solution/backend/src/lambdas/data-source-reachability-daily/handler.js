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

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const { registerServices } = require('@aws-ee/base-services/lib/utils/services-registration-util');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const pluginRegistry = require('./plugins/plugin-registry');

const handler = async () => {
  const container = new ServicesContainer(['settings', 'log']);
  // registerServices - Registers services by calling each service registration plugin in order.
  await registerServices(container, pluginRegistry);
  await container.initServices();
  const dataSourceReachabilityService = await container.find('dataSourceReachabilityService');
  const userContext = getSystemRequestContext();

  // This force-checks reachability for ALL Data Source Accounts,
  // and subsequently kicks off reachability checks for ALL Data Source Studies (irrespective of their current status)
  await dataSourceReachabilityService.attemptReach(userContext, { id: '*' }, { forceCheckAll: true });
};

// eslint-disable-next-line import/prefer-default-export
module.exports.handler = handler;
