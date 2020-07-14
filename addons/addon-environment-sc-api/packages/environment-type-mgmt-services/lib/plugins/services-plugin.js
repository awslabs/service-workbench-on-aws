const EnvTypeService = require('../environment-type/env-type-service');
const EnvTypeConfigService = require('../environment-type/env-type-config-service');
const EnvTypeConfigAuthzService = require('../environment-type/env-type-config-authz-service');
const EnvTypeConfigVarService = require('../environment-type/env-type-config-var-service');
const EnvTypeCandidateService = require('../environment-type/env-type-candidate-service');

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
  container.register('envTypeService', new EnvTypeService());
  container.register('envTypeConfigService', new EnvTypeConfigService());
  container.register('envTypeConfigAuthzService', new EnvTypeConfigAuthzService());
  container.register('envTypeConfigVarService', new EnvTypeConfigVarService());
  container.register('envTypeCandidateService', new EnvTypeCandidateService());
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
  table('dbTableEnvironmentTypes', 'DbEnvironmentTypes');

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
