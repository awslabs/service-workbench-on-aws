/* eslint-disable no-await-in-loop */
const Service = require('@aws-ee/base-services-container/lib/service');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

class AddStepTemplates extends Service {
  constructor() {
    super();
    this.dependency(['deploymentStoreService', 'stepTemplateService', 'stepRegistryService']);
  }

  async init() {
    await super.init();
  }

  async execute() {
    const [registryService] = await this.service(['stepRegistryService']);

    // steps = [ { id, v, yaml, implClass }]
    const steps = await registryService.listSteps();

    /* eslint-disable no-restricted-syntax */
    for (const step of steps) {
      const { id, v, yaml } = step;
      const encodedId = `${id}-${v}`;
      const yamlStr = JSON.stringify(yaml);
      const existingItem = await this.findDeploymentItem({ id: encodedId });

      if (existingItem && yamlStr === existingItem.value) {
        this.log.info(`Skip step template [${id}] v${v} "${step.yaml.title}"`);
      } else {
        this.log.info(`Add/Update step template [${id}] v${v} "${step.yaml.title}"`);
        await this.createVersion(yaml);
        await this.createDeploymentItem({ encodedId, yamlStr });
      }
    }
    /* eslint-enable no-restricted-syntax */
  }

  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.find({ type: 'step-template', id });
  }

  async createDeploymentItem({ encodedId, yamlStr }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);

    return deploymentStore.createOrUpdate({ type: 'step-template', id: encodedId, value: yamlStr });
  }

  async createVersion(yaml) {
    const [stepTemplateService] = await this.service(['stepTemplateService']);
    const { id, v } = yaml;
    const requestContext = getSystemRequestContext();
    const existing = await stepTemplateService.findVersion({ id, v, fields: [] });

    if (existing) {
      const data = { ...yaml, rev: existing.rev };
      return stepTemplateService.updateVersion(requestContext, data);
    }
    return stepTemplateService.createVersion(requestContext, yaml);
  }
}

module.exports = AddStepTemplates;
