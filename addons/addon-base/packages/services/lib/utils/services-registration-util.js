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
const EnvSettingsService = require('../settings/env-settings-service');
const LoggerService = require('../logger/logger-service');

/**
 * Utility function to register services by calling each service registration plugin in order.
 * @param {*} container An instance of ServicesContainer
 * @param {getPlugins} pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 * Each 'service' plugin in the returned array is an object containing "registerServices" method.
 *
 * @returns {Promise<void>}
 */
async function registerServices(container, pluginRegistry) {
  // Get all services plugins from the services plugin registry
  // Each plugin is an object containing "registerServices" method
  const plugins = await pluginRegistry.getPlugins('service');

  if (!_.isArray(plugins)) {
    throw new Error('Expecting plugins to be an array');
  }

  // Register settings service first
  const settingsService = await registerSettingsService(container, plugins, pluginRegistry);

  // Next, register logger service
  await registerLoggerService(container, plugins, settingsService, pluginRegistry);

  // Finally, register all other services
  await registerOtherServices(container, plugins, pluginRegistry);
}

async function registerOtherServices(container, plugins, pluginRegistry) {
  await visitPlugins(plugins, 'registerServices', container, pluginRegistry);
}

async function registerSettingsService(container, plugins, pluginRegistry) {
  // Now, register default implementation of the settings service that provides settings from environment variables
  const settingsService = new EnvSettingsService({
    provider: {
      getDefaults: settings => {
        // Ask each plugin to return their static settings. Each plugin is passed a plain JavaScript object containing the
        // static settings collected so far from other plugins. The plugins are called in the same order as returned by the
        // registry.
        // Each plugin gets a chance to add, remove, update, or delete static settings by mutating the provided staticSettings object.
        const initialStaticSettings = {};
        const staticSettings = _.reduce(
          plugins,
          (staticSettingsSoFar, plugin) => {
            if (_.isFunction(plugin.getStaticSettings)) {
              return plugin.getStaticSettings(staticSettingsSoFar, settings, pluginRegistry);
            }
            return staticSettingsSoFar;
          },
          initialStaticSettings,
        );
        return staticSettings;
      },
    },
  });
  container.register('settings', settingsService);

  // Now, give every plugin a chance to swap out the settings service implementation with its own implementation
  // of settings service by calling the "registerSettingsService" method. The plugins may or may not
  // implement this method.
  // The plugins are called in the same order as returned by the registry.
  // Each plugin gets a chance to swap out the settings service implementation registered by previous plugins.
  await visitPlugins(plugins, 'registerSettingsService', container);

  // TODO: Capture and return the "settings" service registered by the last plugin instead of returning "settingsService"
  return settingsService;
}

async function registerLoggerService(container, plugins, settingsService, pluginRegistry) {
  // We can use "settingsService" here because the settingsService is dependency free and has no "init" method and does not
  // require initialization by the services container. Usually other services that implement the "init" method can not be used
  // before they are initialized by the services container
  const solutionName = settingsService.optional('solutionName', '');
  const envType = settingsService.optional('envType', '');
  const envName = settingsService.optional('envName', '');
  const initialLoggingContext = { solutionName, envType, envName };
  // Ask each plugin to return their logging context. Each plugin is passed a plain JavaScript object containing the
  // loggingContext collected so far from other plugins. The plugins are called in the same order as returned by the
  // registry.
  // Each plugin gets a chance to add, remove, update, or delete logging context items by mutating the provided loggingContext object.
  const loggingContext = await _.reduce(
    plugins,
    async (loggingContextSoFar, plugin) => {
      if (_.isFunction(plugin.getLoggingContext)) {
        return plugin.getLoggingContext(await loggingContextSoFar, pluginRegistry);
      }
      return loggingContextSoFar;
    },
    Promise.resolve(initialLoggingContext),
  );

  // Now, give each plugin a chance to return their sensitive key names for masking.
  // Each plugin is passed an array containing the names of the fields to mask. The plugins are called in the same order as returned by the
  // registry.
  // Each plugin gets a chance to add, remove, update, or delete fields to mask array by mutating the provided fieldsToMask array.
  const initialFieldsToMask = ['x-amz-security-token', 'accessKey', 'password']; // initialize with default fields to mask
  const fieldsToMask = await _.reduce(
    plugins,
    async (fieldsToMaskSoFar, plugin) => {
      if (_.isFunction(plugin.getFieldsToMaskInLog)) {
        return plugin.getFieldsToMaskInLog(await fieldsToMaskSoFar, pluginRegistry);
      }
      return fieldsToMaskSoFar;
    },
    Promise.resolve(initialFieldsToMask),
  );
  // Now, register default implementation of the logger service
  container.register('log', new LoggerService(console, loggingContext, fieldsToMask), {
    lazy: false,
  });
  // Now, give every plugin a chance to swap out the logger service implementation with its own implementation
  // by calling the "registerLoggerService" method. The plugins may or may not implement this method.
  // The plugins are called in the same order as returned by the registry.
  // Each plugin gets a chance to swap out the logger service implementation registered by previous plugins.
  await visitPlugins(plugins, 'registerLoggerService', container, settingsService, pluginRegistry);
}

async function visitPlugins(plugins, methodName, ...args) {
  // visit each plugin in strict order
  for (let i = 0; i < plugins.length; i += 1) {
    const plugin = plugins[i];
    // check if the visit method exists and is a function
    if (_.isFunction(plugin[methodName])) {
      // We need to await specified method call in strict sequence of plugins so awaiting in loop
      // eslint-disable-next-line no-await-in-loop
      await plugin[methodName](...args);
    }
  }
}

module.exports = { registerServices };
