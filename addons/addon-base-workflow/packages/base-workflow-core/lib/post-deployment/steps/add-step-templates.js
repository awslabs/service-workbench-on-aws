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
