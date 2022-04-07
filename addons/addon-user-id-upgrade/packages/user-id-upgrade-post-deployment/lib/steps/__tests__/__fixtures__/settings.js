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

const { registerServices } = require('@amzn/base-services/lib/utils/services-registration-util');
const basePlugin = require('@amzn/base-api-handler/lib/plugins/services-plugin');
const postPlugin = require('@amzn/base-post-deployment/lib/plugins/services-plugin');

const plugin = require('../../../plugins/services-plugin');

const keys = {
  dbPrefix: 'dbPrefix',
  dbDeploymentStore: 'dbDeploymentStore',
};

const extensionPoints = {
  service: [
    {
      getStaticSettings: (existing, s, pluginRegistry) => {
        const settings = {
          get: key => keys[key],
        };
        const output = {
          ...basePlugin.getStaticSettings(existing, settings, pluginRegistry),
          ...plugin.getStaticSettings(existing, settings, pluginRegistry),
          ...postPlugin.getStaticSettings(existing, settings, pluginRegistry),
          ...keys,
        };

        return output;
      },
    },
  ],
};

async function registerSettings(container) {
  await registerServices(container, { getPlugins: point => extensionPoints[point] });
}

module.exports = registerSettings;
