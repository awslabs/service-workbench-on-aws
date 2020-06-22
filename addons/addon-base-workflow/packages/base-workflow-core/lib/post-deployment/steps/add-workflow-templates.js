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

class AddWorkflowTemplates extends Service {
  constructor() {
    // eslint-disable-line no-useless-constructor
    super();
    this.dependency(['deploymentStoreService', 'workflowTemplateService', 'workflowTemplateRegistryService']);
  }

  async init() {
    await super.init();
  }

  async execute() {
    const [registryService] = await this.service(['workflowTemplateRegistryService']);

    // workflowTemplates = [ { id, v, yaml }]
    const workflowTemplates = await registryService.listWorkflowTemplates();

    /* eslint-disable no-restricted-syntax */
    for (const template of workflowTemplates) {
      const { id, v, yaml } = template;
      const encodedId = `${id}-${v}`;
      const yamlStr = JSON.stringify(yaml);
      const existingItem = await this.findDeploymentItem({ id: encodedId });

      if (existingItem && yamlStr === existingItem.value) {
        this.log.info(`Skip template [${id}] v${v} "${template.yaml.title}"`);
      } else {
        this.log.info(`Add/Update template [${id}] v${v} "${template.yaml.title}"`);
        await this.createVersion(yaml);
        await this.createDeploymentItem({ encodedId, yamlStr });
      }
    }
    /* eslint-enable no-restricted-syntax */
  }

  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.find({ type: 'workflow-template', id });
  }

  async createDeploymentItem({ encodedId, yamlStr }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);

    return deploymentStore.createOrUpdate({ type: 'workflow-template', id: encodedId, value: yamlStr });
  }

  async createVersion(yaml) {
    const [workflowTemplateService] = await this.service(['workflowTemplateService']);
    const { id, v } = yaml;
    const requestContext = getSystemRequestContext();
    const existing = await workflowTemplateService.findVersion({ id, v, fields: [] });

    if (existing) {
      const data = { ...yaml, rev: existing.rev };
      return workflowTemplateService.updateVersion(requestContext, data);
    }
    return workflowTemplateService.createVersion(requestContext, yaml);
  }
}

module.exports = AddWorkflowTemplates;
