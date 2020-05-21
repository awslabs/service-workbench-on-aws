const StepTemplateService = require('@aws-ee/base-workflow-core/lib/workflow/step/step-template-service');
const WorkflowTemplateDraftService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-template-draft-service');
const WorkflowTemplateService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-template-service');
const WorkflowService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-service');
const WorkflowDraftService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-draft-service');
const WorkflowAssignmentService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-assignment-service');
const WorkflowInstanceService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-instance-service');
const WorkflowTriggerService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-trigger-service');

const settingKeys = {
  tablePrefix: 'dbTablePrefix',
};

/**
 * Registers the services needed by the workflow to expose its API in the api-handler lambda function
 * @param container An instance of ServicesContainer to register services to
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function registerServices(container, pluginRegistry) {
  container.register('stepTemplateService', new StepTemplateService());
  container.register('workflowTemplateDraftService', new WorkflowTemplateDraftService());
  container.register('workflowTemplateService', new WorkflowTemplateService());
  container.register('workflowService', new WorkflowService());
  container.register('workflowDraftService', new WorkflowDraftService());
  container.register('workflowAssignmentService', new WorkflowAssignmentService());
  container.register('workflowInstanceService', new WorkflowInstanceService());
  container.register('workflowTriggerService', new WorkflowTriggerService());
}

/**
 * Registers static settings needed by the workflow to expose its API in the api-handler lambda function
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
  table('dbTableStepTemplates', 'DbStepTemplates');
  table('dbTableWorkflowTemplates', 'DbWorkflowTemplates');
  table('dbTableWorkflowTemplateDrafts', 'DbWorkflowTemplateDrafts');
  table('dbTableWorkflowDrafts', 'DbWorkflowDrafts');
  table('dbTableWorkflows', 'DbWorkflows');
  table('dbTableWorkflowInstances', 'DbWorkflowInstances');
  table('dbTableWfAssignments', 'DbWfAssignments');

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
