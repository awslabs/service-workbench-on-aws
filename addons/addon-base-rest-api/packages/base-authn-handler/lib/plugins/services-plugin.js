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

const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const S3Service = require('@aws-ee/base-services/lib/s3-service');
const IamService = require('@aws-ee/base-services/lib/iam/iam-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuthorizationService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const UserAuthzService = require('@aws-ee/base-services/lib/user/user-authz-service');
const UserService = require('@aws-ee/base-services/lib/user/user-service');
const AuthenticationService = require('@aws-ee/base-api-services/lib/authentication-service');
const AuthenticationProviderConfigService = require('@aws-ee/base-api-services/lib/authentication-providers/authentication-provider-config-service');
const AuthenticationProviderTypeService = require('@aws-ee/base-api-services/lib/authentication-providers/authentication-provider-type-service');
const DbAuthenticationService = require('@aws-ee/base-api-services/lib/db-authentication-service');
const DbPasswordService = require('@aws-ee/base-services/lib/db-password/db-password-service');
const JwtService = require('@aws-ee/base-api-services/lib/jwt-service');
const TokenRevocationService = require('@aws-ee/base-api-services/lib/token-revocation-service');
const registerBuiltInAuthProviders = require('@aws-ee/base-api-services/lib/authentication-providers/register-built-in-provider-services');
const registerBuiltInAuthProvisioners = require('@aws-ee/base-api-services/lib/authentication-providers/register-built-in-provisioner-services');

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
// eslint-disable-next-line no-unused-vars
async function registerServices(container, pluginRegistry) {
  container.register('aws', new AwsService());
  container.register('s3Service', new S3Service());
  container.register('iamService', new IamService());
  container.register('authenticationProviderConfigService', new AuthenticationProviderConfigService());
  container.register('authenticationProviderTypeService', new AuthenticationProviderTypeService());
  container.register('authenticationService', new AuthenticationService());
  container.register('tokenRevocationService', new TokenRevocationService());

  // Register all the built in authentication providers supported by the data lake out of the box
  registerBuiltInAuthProviders(container);
  registerBuiltInAuthProvisioners(container);

  container.register('dbService', new DbService(), { lazy: false });
  container.register('dbAuthenticationService', new DbAuthenticationService());
  container.register('dbPasswordService', new DbPasswordService());
  container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
  container.register('jwtService', new JwtService());
  container.register('userService', new UserService());
  container.register('auditWriterService', new AuditWriterService());
  container.register('pluginRegistryService', new PluginRegistryService(pluginRegistry), { lazy: false });

  // Authorization Services from base addon
  container.register('authorizationService', new AuthorizationService());
  container.register('userAuthzService', new UserAuthzService());
}

/**
 * A function that registers base static settings required by the base addon for api handler lambda function
 * @param existingStaticSettings
 * @param settings
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
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
