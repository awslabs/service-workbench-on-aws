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

const StepReporterBase = require('@aws-ee/workflow-engine/lib/step/step-reporter');
const { normalizeError } = require('@aws-ee/workflow-engine/lib/helpers/utils');

// --------------------------------------------------
// StepReporter
// --------------------------------------------------
class StepReporter extends StepReporterBase {
  constructor({ workflowReporter, step, workflowInstanceService }) {
    super({ workflowReporter, step });
    this.instanceId = workflowReporter.wfInstance.id;
    this.stepIndex = step.index;
    this.instanceService = workflowInstanceService;
  }

  async stepStarted() {
    await super.stepStarted();
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    const startTime = new Date().toISOString();
    return this.instanceService.changeStepStatus({
      instanceId,
      stepIndex,
      step,
      wfInstance,
      status: 'in_progress',
      startTime,
    });
  }

  async stepSkipped() {
    await super.stepSkipped();
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    return this.instanceService.changeStepStatus({
      instanceId,
      stepIndex,
      step,
      wfInstance,
      status: 'skipped',
    });
  }

  async stepPaused(reasonForPause) {
    await super.stepPaused(reasonForPause);
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    const endTime = new Date().toISOString();
    return this.instanceService.changeStepStatus({
      instanceId,
      stepIndex,
      step,
      wfInstance,
      status: 'paused',
      endTime,
    });
  }

  async stepResumed(reasonForResume) {
    await super.stepResumed(reasonForResume);
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    const endTime = new Date().toISOString();
    return this.instanceService.changeStepStatus({
      instanceId,
      stepIndex,
      step,
      wfInstance,
      status: 'in_progress',
      endTime,
    });
  }

  async stepMaxPauseReached() {
    return this.stepResumed('max pause time exhausted');
  }

  async stepPassed() {
    await super.stepPassed();
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    const endTime = new Date().toISOString();
    return this.instanceService.changeStepStatus({ instanceId, stepIndex, step, wfInstance, status: 'done', endTime });
  }

  // error is just an object (not necessarily an instance of Error) with the following two properties:
  // - message & stack
  async stepFailed(error) {
    await super.stepFailed(error);
    const { msg } = normalizeError(error);
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    const endTime = new Date().toISOString();
    return this.instanceService.changeStepStatus({
      instanceId,
      stepIndex,
      step,
      wfInstance,
      status: 'error',
      message: msg,
      endTime,
    });
  }

  async statusMessage(message) {
    await super.statusMessage(message);
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    return this.instanceService.changeStepStatus({ instanceId, stepIndex, step, wfInstance, message });
  }

  async clearStatusMessage() {
    await super.clearStatusMessage();
    const { instanceId, stepIndex, step } = this;
    const wfInstance = this.workflowReporter.wfInstance;
    return this.instanceService.changeStepStatus({
      instanceId,
      stepIndex,
      step,
      wfInstance,
      clearMessage: true,
    });
  }
}

module.exports = StepReporter;
