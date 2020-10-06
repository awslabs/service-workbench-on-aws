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

const settingKeys = {
  tablePrefix: 'dbPrefix',
};

// eslint-disable-next-line no-empty-function, no-unused-vars
async function registerServices(container, pluginRegistry) {}

/**
 * A function that registers static settings
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

  table('dbDeploymentStoreDepreciated', 'DbDeploymentStore');
  table('dbPasswordsDepreciated', 'DbPasswords');
  table('dbUsersDepreciated', 'DbUsers');
  table('dbAuthenticationProviderTypesDepreciated', 'DbAuthenticationProviderTypes');
  table('dbAuthenticationProviderConfigsDepreciated', 'DbAuthenticationProviderConfigs');
  table('dbStepTemplatesDepreciated', 'DbStepTemplates');
  table('dbWorkflowTemplatesDepreciated', 'DbWorkflowTemplates');
  table('dbWorkflowsDepreciated', 'DbWorkflows');
  table('dbWfAssignmentsDepreciated', 'DbWfAssignments');
  table('dbWorkflowInstancesDepreciated', 'DbWorkflowInstances');
  table('dbWorkflowTemplateDraftsDepreciated', 'DbWorkflowTemplateDrafts');
  table('dbWorkflowDraftsDepreciated', 'DbWorkflowDrafts');
  table('dbRevokedTokensDepreciated', 'DbRevokedTokens');
  table('dbLocksDepreciated', 'DbLocks');
  table('dbUserApiKeysDepreciated', 'DbUserApiKeys');
  table('dbAccountsDepreciated', 'DbAccounts');
  table('dbUserRolesDepreciated', 'DbUserRoles');
  table('dbAwsAccountsDepreciated', 'DbAwsAccounts');
  table('dbCostApiCachesDepreciated', 'DbCostApiCaches');
  table('dbEnvironmentsScDepreciated', 'DbEnvironmentsSc');
  table('dbIndexesDepreciated', 'DbIndexes');
  table('dbEnvironmentTypesDepreciated', 'DbEnvironmentTypes');
  table('dbEnvironmentsDepreciated', 'DbEnvironments');
  table('dbKeyPairsDepreciated', 'DbKeyPairs');
  table('dbProjectsDepreciated', 'DbProjects');
  table('dbStudyPermissionsDepreciated', 'DbStudyPermissions');
  table('dbStudiesDepreciated', 'DbStudies');

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
