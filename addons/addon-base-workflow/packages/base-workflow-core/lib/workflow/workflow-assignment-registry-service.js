const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

const inputSchema = require('../schema/create-wf-assignment');

class WorkflowAssignmentRegistryService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'pluginRegistryService']);
  }

  async init() {
    await super.init();
    this.store = {}; // a map { <id>: { id, triggerType, triggerData, wf } }

    const registry = await this.service('pluginRegistryService');
    // We loop through each plugin and ask it to register its assignments
    const plugins = await registry.getPlugins('workflow-assignments');
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of plugins) {
      // eslint-disable-next-line no-await-in-loop
      await plugin.registerWorkflowAssignments(this);
    }
  }

  async add(rawData) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);
    const { id } = rawData;

    await jsonSchemaValidationService.ensureValid(rawData, inputSchema);

    // We allow assignments with the same ids to be overwritten
    this.store[id] = rawData;
  }

  async findAssignment(id) {
    return this.store[id];
  }

  // Returns a list of all assignment in array of this shape: [{ id, triggerType, triggerData, wf }, ...]
  async listAssignments() {
    return _.values(this.store);
  }
}

module.exports = WorkflowAssignmentRegistryService;
