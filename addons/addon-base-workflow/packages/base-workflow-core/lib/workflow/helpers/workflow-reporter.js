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

const WorkflowReporterBase = require('@aws-ee/workflow-engine/lib/workflow-reporter');
const { normalizeError } = require('@aws-ee/workflow-engine/lib/helpers/utils');

const StepReporter = require('./step-reporter');

// --------------------------------------------------
// WorkflowReporter
// --------------------------------------------------
class WorkflowReporter extends WorkflowReporterBase {
  constructor({ workflowInstance = {}, log, workflowInstanceService }) {
    super({ workflowInstance, log });
    this.instanceService = workflowInstanceService;
  }

  async workflowStarted() {
    await super.workflowStarted();
    return this.instanceService.changeWorkflowStatus({
      workflowId: this.wfInstance.wf.id,
      instanceId: this.wfInstance.id,
      status: 'in_progress',
    });
  }

  async workflowPaused() {
    await super.workflowPaused();
    return this.instanceService.changeWorkflowStatus({
      workflowId: this.wfInstance.wf.id,
      instanceId: this.wfInstance.id,
      status: 'paused',
    });
  }

  async workflowResuming() {
    await super.workflowResuming();
    return this.instanceService.changeWorkflowStatus({
      workflowId: this.wfInstance.wf.id,
      instanceId: this.wfInstance.id,
      status: 'in_progress',
    });
  }

  async workflowPassed() {
    await super.workflowPassed();
    return this.instanceService.changeWorkflowStatus({
      workflowId: this.wfInstance.wf.id,
      instanceId: this.wfInstance.id,
      status: 'done',
    });
  }

  // error is just an object (not necessarily an instance of Error) with the following two properties:
  // - message & stack
  async workflowFailed(error) {
    await super.workflowFailed(error);
    const { msg } = normalizeError(error);
    return this.instanceService.changeWorkflowStatus({
      workflowId: this.wfInstance.wf.id,
      instanceId: this.wfInstance.id,
      status: 'error',
      message: msg,
    });
  }

  getStepReporter({ step }) {
    return new StepReporter({ workflowReporter: this, step, workflowInstanceService: this.instanceService });
  }
}

module.exports = WorkflowReporter;
