const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const DbAuthenticationService = require('@aws-ee/base-api-services/lib/db-authentication-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const InputManifestValidationService = require('@aws-ee/base-services/lib/input-manifest/input-manifest-validation-service');
const S3Service = require('@aws-ee/base-services/lib/s3-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuthorizationService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const UserAuthzService = require('@aws-ee/base-services/lib/user/user-authz-service');
const UserService = require('@aws-ee/base-services/lib/user/user-service');
const AuthenticationProviderConfigService = require('@aws-ee/base-api-services/lib/authentication-providers/authentication-provider-config-service');
const AuthenticationProviderTypeService = require('@aws-ee/base-api-services/lib/authentication-providers/authentication-provider-type-service');
const DbPasswordService = require('@aws-ee/base-services/lib/db-password/db-password-service');
const JwtService = require('@aws-ee/base-api-services/lib/jwt-service');
const registerBuiltInAuthProviders = require('@aws-ee/base-api-services/lib/authentication-providers/register-built-in-provider-services');
const registerBuiltInAuthProvisioners = require('@aws-ee/base-api-services/lib/authentication-providers/register-built-in-provisioner-services');
const ApiKeyService = require('@aws-ee/base-api-services/lib/authentication-providers/built-in-providers/internal/api-key-service');
const TokenRevocationService = require('@aws-ee/base-api-services/lib/token-revocation-service');

const settingKeys = {
  tablePrefix: 'dbTablePrefix',
};

/**
 * A function that registers base services required by the base addon for api handler lambda function
 * @param container An instance of ServicesContainer to register services to
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
async function registerServices(container, pluginRegistry) {
  container.register('aws', new AwsService(), { lazy: false });

  container.register('authenticationProviderConfigService', new AuthenticationProviderConfigService());
  container.register('authenticationProviderTypeService', new AuthenticationProviderTypeService());
  // Register all the built in authentication providers supported by the base out of the box
  registerBuiltInAuthProviders(container);
  registerBuiltInAuthProvisioners(container);

  container.register('dbService', new DbService(), { lazy: false });
  container.register('dbAuthenticationService', new DbAuthenticationService());
  container.register('dbPasswordService', new DbPasswordService());
  container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
  container.register('inputManifestValidationService', new InputManifestValidationService());
  container.register('jwtService', new JwtService());
  container.register('userService', new UserService());
  container.register('s3Service', new S3Service());
  container.register('lockService', new LockService());
  container.register('apiKeyService', new ApiKeyService());
  container.register('tokenRevocationService', new TokenRevocationService());
  container.register('auditWriterService', new AuditWriterService());
  container.register('pluginRegistryService', new PluginRegistryService(pluginRegistry), { lazy: false });

  // Authorization Services from base addon
  container.register('authorizationService', new AuthorizationService());
  container.register('userAuthzService', new UserAuthzService());
}

/**
 * A function that registers base static settings required by the base addon for api handler lambda function
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
  table('dbTableAuthenticationProviderTypes', 'DbAuthenticationProviderTypes');
  table('dbTableAuthenticationProviderConfigs', 'DbAuthenticationProviderConfigs');
  table('dbTablePasswords', 'DbPasswords');
  table('dbTableUserApiKeys', 'DbUserApiKeys');
  table('dbTableRevokedTokens', 'DbRevokedTokens');
  table('dbTableUsers', 'DbUsers');
  table('dbTableLocks', 'DbLocks');

  return staticSettings;
}

const plugin = {
  getStaticSettings,
  // getLoggingContext, // not implemented, the default behavior provided by addon-base is sufficient
  // getLoggingContext, // not implemented, the default behavior provided by addon-base is sufficient
  // registerSettingsService, // not implemented, the default behavior provided by addon-base is sufficient
  // registerLoggerService, // not implemented, the default behavior provided by addon-base is sufficient
  registerServices,
};

module.exports = plugin;
