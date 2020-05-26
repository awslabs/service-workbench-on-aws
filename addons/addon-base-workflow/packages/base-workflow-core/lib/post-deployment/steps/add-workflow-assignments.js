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

class AddWorkflowAssignments extends Service {
  constructor() {
    // eslint-disable-line no-useless-constructor
    super();
    this.dependency(['deploymentStoreService', 'workflowAssignmentRegistryService', 'workflowAssignmentService']);
  }

  async init() {
    await super.init();
  }

  async execute() {
    const [registryService] = await this.service(['workflowAssignmentRegistryService']);

    const assignments = await registryService.listAssignments();

    /* eslint-disable no-restricted-syntax */
    for (const assignment of assignments) {
      const { id } = assignment;
      const assignmentStr = JSON.stringify(assignment);
      const existingItem = await this.findDeploymentItem({ id });

      if (existingItem && assignmentStr === existingItem.value) {
        this.log.info(
          `Skip workflow assignment id "${id}" triggerType "${assignment.triggerType}" triggerTypeData "${assignment.triggerTypeData}"`,
        );
      } else {
        this.log.info(
          `Add/Update workflow assignment id "${id}" triggerType "${assignment.triggerType}" triggerTypeData "${assignment.triggerTypeData}"`,
        );
        await this.createAssignment(assignment);
        await this.createDeploymentItem(assignment);
      }
    }
    /* eslint-enable no-restricted-syntax */
  }

  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.find({ type: 'workflow-assignment', id });
  }

  async createDeploymentItem(assignment) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    const { id } = assignment;
    const assignmentStr = JSON.stringify(assignment);

    return deploymentStore.createOrUpdate({ type: 'workflow-assignment', id, value: assignmentStr });
  }

  async createAssignment(assignment) {
    const [assignmentService] = await this.service(['workflowAssignmentService']);
    const { id } = assignment;
    const requestContext = getSystemRequestContext();
    const existing = await assignmentService.find(requestContext, { id });

    if (existing) {
      const data = { ...assignment, rev: existing.rev };
      return assignmentService.update(requestContext, data);
    }
    return assignmentService.create(requestContext, assignment);
  }
}

module.exports = AddWorkflowAssignments;
