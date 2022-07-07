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

const ServicesContainer = require('@amzn/base-services-container/lib/services-container');
const { registerServices } = require('@amzn/base-services/lib/utils/services-registration-util');
const { getSystemRequestContext } = require('@amzn/base-services/lib/helpers/system-context');

const pluginRegistry = require('./plugins/plugin-registry');

const handler = async () => {
  const container = new ServicesContainer(['settings', 'log']);
  // registerServices - Registers services by calling each service registration plugin in order.
  await registerServices(container, pluginRegistry);
  await container.initServices();
  await handlerWithContainer(container);
};

const handlerWithContainer = async container => {
  const awsCfnService = await container.find('awsCfnService');
  const userContext = getSystemRequestContext();

  // Check permission status of all accounts
  await awsCfnService.batchCheckAndUpdateAccountPermissions(userContext);
};

// eslint-disable-next-line import/prefer-default-export
module.exports.handler = handler;
module.exports.handlerWithContainer = handlerWithContainer;
