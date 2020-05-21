const AddStepTemplates = require('../steps/add-step-templates');
const AddWorkflowTemplates = require('../steps/add-workflow-templates');
const AddWorkflows = require('../steps/add-workflows');
const AddWorkflowAssignments = require('../steps/add-workflow-assignments');

/**
 * Returns a map of post deployment steps
 *
 * @param existingStepsMap Map of existing post deployment steps
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>}
 */
// eslint-disable-next-line no-unused-vars
async function getSteps(existingStepsMap, pluginRegistry) {
  const stepsMap = new Map([
    ...existingStepsMap,
    ['addStepTemplates', new AddStepTemplates()],
    ['addWorkflowTemplates', new AddWorkflowTemplates()],
    ['addWorkflows', new AddWorkflows()],
    ['addWorkflowAssignments', new AddWorkflowAssignments()],
  ]);

  return stepsMap;
}

const plugin = {
  getSteps,
};

module.exports = plugin;
