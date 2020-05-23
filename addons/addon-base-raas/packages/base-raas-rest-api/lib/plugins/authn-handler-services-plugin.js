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

const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const UserService = require('@aws-ee/base-raas-services/lib/user/user-service');
const UserAuthzService = require('@aws-ee/base-raas-services/lib/user/user-authz-service');
const UserRoleService = require('@aws-ee/base-raas-services/lib/user-roles/user-roles-service');
const UserAttributesMapperService = require('@aws-ee/base-raas-services/lib/user/user-attributes-mapper-service');

const settingKeys = {
  tablePrefix: 'dbTablePrefix',
};

/**
 * Registers the services needed by the workflow loop runner lambda function
 * @param container An instance of ServicesContainer to register services to
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function registerServices(container, pluginRegistry) {
  container.register('userService', new UserService());
  // The base authn provider uses username by concatenating username with auth provider name and idp name
  // In RaaS, the email address should be used as username so register custom UserAttributesMapperService that maps
  // attribs from decoded token to user
  container.register('userAttributesMapperService', new UserAttributesMapperService());
  container.register('userRolesService', new UserRoleService());
  container.register('pluginRegistryService', new PluginRegistryService(pluginRegistry), { lazy: false });
  container.register('raasUserAuthzService', new UserAuthzService());
}

/**
 * Registers static settings required by the workflow loop runner lambda function
 * @param existingStaticSettings An existing static settings plain javascript object containing settings as key/value contributed by other plugins
 * @param settings Default instance of settings service that resolves settings from environment variables
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point
 *
 * @returns {Promise<*>} A promise that resolves to static settings object
 */
// eslint-disable-next-line no-unused-vars
function getStaticSettings(existingStaticSettings, settings, pluginRegistry) {
  const staticSettings = {
    ...existingStaticSettings,
  };

  // Register all dynamodb table names used by the base rest api addon
  const tablePrefix = settings.get(settingKeys.tablePrefix);
  const table = (key, suffix) => {
    staticSettings[key] = `${tablePrefix}-${suffix}`;
  };
  table('dbTableUserRoles', 'DbUserRoles');

  return staticSettings;
}

const plugin = {
  getStaticSettings,
  // getLoggingContext, // not implemented, the default behavior provided by addon-base is sufficient
  // registerSettingsService, // not implemented, the default behavior provided by addon-base is sufficient
  // registerLoggerService, // not implemented, the default behavior provided by addon-base is sufficient
  registerServices,
};

module.exports = plugin;
