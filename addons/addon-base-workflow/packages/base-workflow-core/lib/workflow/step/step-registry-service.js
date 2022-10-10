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

const _ = require('lodash');
const Service = require('@amzn/base-services-container/lib/service');

const inputSchema = require('../../schema/step-template.json');

class StepRegistryService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'pluginRegistryService']);
  }

  async init() {
    await super.init();
    this.store = []; // an array of objects of this shape: { key: <id_ver>, value: { yaml, implClass } }

    const registry = await this.service('pluginRegistryService');
    // We loop through each step plugin and ask it to register its steps
    const plugins = await registry.getPlugins('workflow-steps');
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of plugins) {
      // eslint-disable-next-line no-await-in-loop
      await plugin.registerWorkflowSteps(this);
    }
  }

  async add({ yaml, implClass }) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);
    const { id, v } = yaml;
    const existing = await this.findStep({ id, v });

    if (existing)
      throw this.boom.badRequest(
        `You tried to register a step, but a step with the same template id "${id}" and version "${v}" already exists`,
        true,
      );
    await jsonSchemaValidationService.ensureValid(yaml, inputSchema);

    const key = this.encodeId({ id, v });
    this.store.push({ key, value: { yaml, implClass } });
  }

  async findStep({ id, v }) {
    const key = this.encodeId({ id, v });
    const entry = _.find(this.store, ['key', key]);
    return entry ? entry.value : undefined;
  }

  async mustFindStep({ id, v }) {
    const step = await this.findStep({ id, v });
    if (!step) {
      throw this.boom.notFound(`The step template "${id}" ver "${v}" is not found`, true);
    }
    return step;
  }

  // Returns a list of all steps in an array of this shape: [{ id, v, yaml, implClass }, ...]
  async listSteps() {
    return _.map(this.store, item => {
      const { yaml, implClass } = item.value;
      const { id, v } = yaml;
      return { id, v, yaml, implClass };
    });
  }

  // private
  encodeId({ id, v }) {
    return `${id}_${v}`;
  }
}

module.exports = StepRegistryService;
