/* eslint-disable no-await-in-loop */
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

const Resource = require('../base/resource');
const { deleteWorkflowVersion } = require('../../complex/delete-workflow-version');
const WorkflowInstances = require('./workflow-instances');

class WorkflowVersion extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'workflowVersion',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [workflowVersion]');
    this.api = `${parent.api}/v/${id}`;
    this.version = this.id;
    this.workflowId = this.parent.id;
  }

  instances() {
    return new WorkflowInstances({ clientSession: this.clientSession, parent: this });
  }

  async trigger(body) {
    return this.instances().create(body);
  }

  async cleanup() {
    // This is the workflow id, we get it by using the parent id
    const id = this.parent.id;
    const version = this.id;
    await deleteWorkflowVersion({ aws: this.setup.aws, id, version });
  }

  // ************************ Helpers methods ************************

  // Triggers the workflow and pulls the the status of the workflow every second and only returns if the status is done
  // or until maxSecondsCount is reached. Default maxSecondsCount is 5 minutes.
  async triggerAndWait(body = {}, maxSecondsCount = 300) {
    const triggerInfo = await this.trigger(body);
    const instanceId = _.get(triggerInfo, 'instance.id');
    await this.waitUntilComplete(instanceId, 1000, maxSecondsCount);
    return triggerInfo;
  }

  // Polls a workflow at an intermittent interval until it has completed, failed, or it has reached the maxIntervalCount.
  async waitUntilComplete(wfInstanceId, interval = 1000, maxIntervalCount = 300) {
    let counter = 0;
    let result;
    do {
      await new Promise(r => setTimeout(r, interval));
      counter += 1;
      result = await this.instances()
        .instance(wfInstanceId)
        .get();
    } while (result.wfStatus !== 'done' && result.wfStatus !== 'error' && counter < maxIntervalCount);
    if (result.wfStatus === 'error' || counter === maxIntervalCount) {
      throw new Error('Workflow failed to complete');
    }
  }

  // Finds a workflow for an environment and polls
  async findAndPollWorkflow(envId, interval, maxCount) {
    const workflows = await this.instances().get();
    const foundWf = _.filter(workflows, wf => {
      return wf.input.envId === envId;
    })[0];
    await this.waitUntilComplete(foundWf.id, interval, maxCount);
  }
}

module.exports = WorkflowVersion;
