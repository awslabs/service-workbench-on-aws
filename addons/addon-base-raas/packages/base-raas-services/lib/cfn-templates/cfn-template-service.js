const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

class CfnTemplateService extends Service {
  constructor() {
    super();
    this.dependency(['pluginRegistryService']);
  }

  async init() {
    await super.init();
    this.store = []; // an array of objects of this shape: { key: <name>, value: { yaml } }
    const registry = await this.service('pluginRegistryService');
    // We loop through each plugin and ask it to register its cfn templates
    const plugins = await registry.getPlugins('cfn-templates');
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of plugins) {
      // eslint-disable-next-line no-await-in-loop
      await plugin.registerCfnTemplates(this);
    }
  }

  async add({ name, yaml }) {
    const existing = await this.getTemplate(name);
    if (existing)
      throw this.boom.badRequest(
        `You tried to register a cfn template, but a cfn template with the same name "${name}" already exists`,
        true,
      );

    this.store.push({ key: name, value: yaml });
  }

  async getTemplate(name) {
    const entry = _.find(this.store, ['key', name]);
    return entry ? entry.value : undefined;
  }
}

module.exports = CfnTemplateService;
