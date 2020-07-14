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
const UserAuthzService = require('@aws-ee/base-raas-services/lib/user/user-authz-service');
const UserService = require('@aws-ee/base-raas-services/lib/user/user-service');
const UserAttributesMapperService = require('@aws-ee/base-raas-services/lib/user/user-attributes-mapper-service');
const StudyService = require('@aws-ee/base-raas-services/lib/study/study-service');
const StudyPermissionService = require('@aws-ee/base-raas-services/lib/study/study-permission-service');
const EnvironmentService = require('@aws-ee/base-raas-services/lib/environment/environment-service');
const EnvironmentKeypairService = require('@aws-ee/base-raas-services/lib/environment/environment-keypair-service');
const EnvironmentAmiService = require('@aws-ee/base-raas-services/lib/environment/environment-ami-service');
const EnvironmentNotebookUrlService = require('@aws-ee/base-raas-services/lib/environment/environment-notebook-url-service');
const EnvironmentScNotebookUrlService = require('@aws-ee/base-raas-services/lib/environment-sc/environment-sc-notebook-url-service');
const EnvironmentSpotPriceHistoryService = require('@aws-ee/base-raas-services/lib/environment/environment-spot-price-history-service');
const UserRolesService = require('@aws-ee/base-raas-services/lib/user-roles/user-roles-service');
const AwsAccountsService = require('@aws-ee/base-raas-services/lib/aws-accounts/aws-accounts-service');
const CostsService = require('@aws-ee/base-raas-services/lib/costs/costs-service');
const CostApiCacheService = require('@aws-ee/base-raas-services/lib/cost-api-cache/cost-api-cache-service');
const IndexesService = require('@aws-ee/base-raas-services/lib/indexes/indexes-service');
const ProjectService = require('@aws-ee/base-raas-services/lib/project/project-service');
const AccountService = require('@aws-ee/base-raas-services/lib/account/account-service');
const CfnTemplateService = require('@aws-ee/base-raas-services/lib/cfn-templates/cfn-template-service');
const ExternalCfnTemplateService = require('@aws-ee/base-raas-services/lib/external-cfn-template/external-cfn-template-service');
const ComputePlatformService = require('@aws-ee/base-raas-services/lib/compute/compute-platform-service');
const ComputePriceService = require('@aws-ee/base-raas-services/lib/compute/compute-price-service');
const EnvironmentAuthzService = require('@aws-ee/base-raas-services/lib/environment/environment-authz-service');
const EnvironmentMountService = require('@aws-ee/base-raas-services/lib/environment/environment-mount-service');
const EnvironmentScService = require('@aws-ee/base-raas-services/lib/environment-sc/environment-sc-service');
const EnvironmentConfigVarsService = require('@aws-ee/base-raas-services/lib/environment-sc/environment-config-vars-service');

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
  container.register('userRolesService', new UserRolesService());
  container.register('studyService', new StudyService());
  container.register('studyPermissionService', new StudyPermissionService());
  container.register('environmentService', new EnvironmentService());
  container.register('environmentKeypairService', new EnvironmentKeypairService());
  container.register('environmentAmiService', new EnvironmentAmiService());
  container.register('environmentNotebookUrlService', new EnvironmentNotebookUrlService());
  container.register('environmentScNotebookUrlService', new EnvironmentScNotebookUrlService());
  container.register('environmentSpotPriceHistoryService', new EnvironmentSpotPriceHistoryService());
  container.register('environmentMountService', new EnvironmentMountService());
  container.register('cfnTemplateService', new CfnTemplateService());
  container.register('awsAccountsService', new AwsAccountsService());
  container.register('costsService', new CostsService());
  container.register('costApiCacheService', new CostApiCacheService());
  container.register('indexesService', new IndexesService());
  container.register('projectService', new ProjectService());
  container.register('accountService', new AccountService());
  container.register('externalCfnTemplateService', new ExternalCfnTemplateService());
  container.register('computePlatformService', new ComputePlatformService());
  container.register('computePriceService', new ComputePriceService());
  container.register('environmentScService', new EnvironmentScService());
  container.register('environmentConfigVarsService', new EnvironmentConfigVarsService());
  container.register('pluginRegistryService', new PluginRegistryService(pluginRegistry), { lazy: false });

  // Authorization Services from raas addon
  container.register('raasUserAuthzService', new UserAuthzService());
  container.register('environmentAuthzService', new EnvironmentAuthzService());
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
  table('dbTableStudies', 'DbStudies');
  table('dbTableEnvironments', 'DbEnvironments');
  table('dbTableEnvironmentsSc', 'DbEnvironmentsSc');
  table('dbTableUserRoles', 'DbUserRoles');
  table('dbTableAwsAccounts', 'DbAwsAccounts');
  table('dbTableIndexes', 'DbIndexes');
  table('dbTableCostApiCaches', 'DbCostApiCaches');
  table('dbTableAccounts', 'DbAccounts');
  table('dbTableProjects', 'DbProjects');
  table('dbTableStudyPermissions', 'DbStudyPermissions');

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
