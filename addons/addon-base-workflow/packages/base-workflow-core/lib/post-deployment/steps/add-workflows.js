/* eslint-disable no-await-in-loop */
const Service = require('@aws-ee/base-services-container/lib/service');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

class AddWorkflows extends Service {
  constructor() {
    // eslint-disable-line no-useless-constructor
    super();
    this.dependency(['deploymentStoreService', 'workflowService', 'workflowRegistryService']);
  }

  async init() {
    await super.init();
  }

  async execute() {
    const [registryService] = await this.service(['workflowRegistryService']);

    // workflows = [ { id, v, yaml }]
    const workflows = await registryService.listWorkflows();

    /* eslint-disable no-restricted-syntax */
    for (const workflow of workflows) {
      const { id, v, yaml } = workflow;
      const encodedId = `${id}-${v}`;
      const yamlStr = JSON.stringify(yaml);
      const existingItem = await this.findDeploymentItem({ id: encodedId });

      if (existingItem && yamlStr === existingItem.value) {
        this.log.info(`Skip workflow [${id}] v${v} "${workflow.yaml.title}"`);
      } else {
        this.log.info(`Add/Update workflow [${id}] v${v} "${workflow.yaml.title}"`);
        await this.createVersion(yaml);
        await this.createDeploymentItem({ encodedId, yamlStr });
      }
    }
    /* eslint-enable no-restricted-syntax */
  }

  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.find({ type: 'workflow', id });
  }

  async createDeploymentItem({ encodedId, yamlStr }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);

    return deploymentStore.createOrUpdate({ type: 'workflow', id: encodedId, value: yamlStr });
  }

  async createVersion(yaml) {
    const [workflowService] = await this.service(['workflowService']);
    const { id, v } = yaml;
    const requestContext = getSystemRequestContext();
    const existing = await workflowService.findVersion({ id, v, fields: [] });

    if (existing) {
      const data = { ...yaml, rev: existing.rev };
      return workflowService.updateVersion(requestContext, data);
    }
    return workflowService.createVersion(requestContext, yaml);
  }
}

module.exports = AddWorkflows;
