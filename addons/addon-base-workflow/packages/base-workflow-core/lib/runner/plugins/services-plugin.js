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
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const InputManifestValidationService = require('@aws-ee/base-services/lib/input-manifest/input-manifest-validation-service');
const S3Service = require('@aws-ee/base-services/lib/s3-service');
const IamService = require('@aws-ee/base-services/lib/iam/iam-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuthorizationService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const UserAuthzService = require('@aws-ee/base-services/lib/user/user-authz-service');
const UserService = require('@aws-ee/base-services/lib/user/user-service');
const DbPasswordService = require('@aws-ee/base-services/lib/db-password/db-password-service');
const StepRegistryService = require('../../workflow/step/step-registry-service');
const StepTemplateService = require('../../workflow/step/step-template-service');
const WorkflowTemplateRegistryService = require('../../workflow/workflow-template-registry-service');
const WorkflowTemplateService = require('../../workflow/workflow-template-service');
const WorkflowService = require('../../workflow/workflow-service');
const WorkflowRegistryService = require('../../workflow/workflow-registry-service');
const WorkflowAssignmentRegistryService = require('../../workflow/workflow-assignment-registry-service');
const WorkflowAssignmentService = require('../../workflow/workflow-assignment-service');
const WorkflowInstanceService = require('../../workflow/workflow-instance-service');
const WorkflowTriggerService = require('../../workflow/workflow-trigger-service');

const settingKeys = {
  tablePrefix: 'dbPrefix',
};

/**
 * Registers the services needed by the workflow loop runner lambda function
 * @param container An instance of ServicesContainer to register services to
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
async function registerServices(container, pluginRegistry) {
  container.register('aws', new AwsService());
  container.register('dbService', new DbService(), { lazy: false });
  container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
  container.register('inputManifestValidationService', new InputManifestValidationService());
  container.register('s3Service', new S3Service());
  container.register('iamService', new IamService());
  container.register('auditWriterService', new AuditWriterService());
  container.register('pluginRegistryService', new PluginRegistryService(pluginRegistry), { lazy: false });
  container.register('lockService', new LockService());
  container.register('userService', new UserService());
  container.register('dbPasswordService', new DbPasswordService());
  container.register('stepRegistryService', new StepRegistryService());
  container.register('stepTemplateService', new StepTemplateService());
  container.register('workflowTemplateService', new WorkflowTemplateService());
  container.register('workflowTemplateRegistryService', new WorkflowTemplateRegistryService());
  container.register('workflowService', new WorkflowService());
  container.register('workflowRegistryService', new WorkflowRegistryService());
  container.register('workflowAssignmentRegistryService', new WorkflowAssignmentRegistryService());
  container.register('workflowAssignmentService', new WorkflowAssignmentService());
  container.register('workflowInstanceService', new WorkflowInstanceService());
  container.register('workflowTriggerService', new WorkflowTriggerService());

  // Authorization Services from base addon
  container.register('authorizationService', new AuthorizationService());
  container.register('userAuthzService', new UserAuthzService());
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
  table('dbUsers', 'Users');
  table('dbLocks', 'Locks');
  table('dbStepTemplates', 'StepTemplates');
  table('dbWorkflowTemplates', 'WorkflowTemplates');
  table('dbWorkflowTemplateDrafts', 'WorkflowTemplateDrafts');
  table('dbWorkflowDrafts', 'WorkflowDrafts');
  table('dbWorkflows', 'Workflows');
  table('dbWorkflowInstances', 'WorkflowInstances');
  table('dbWfAssignments', 'WfAssignments');
  table('dbEgressStore', 'EgressStore');

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
