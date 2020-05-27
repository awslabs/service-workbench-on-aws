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

const StepConfig = require('./step-config');
const WaitDecisionBuilder = require('./decisions/wait-decision-builder');
const PauseDecisionBuilder = require('./decisions/pause-decision-builder');
const CallDecision = require('./decisions/call-decision');
const GoToDecision = require('./decisions/goto-decision');
const Invoker = require('./invoker');
const KeyGetterDelegate = require('../helpers/key-getter-delegate');

class StepBase {
  constructor({ input, workflowInstance, workflowPayload, stepState, step, stepReporter, workflowStatus }) {
    this.input = input;
    this.workflowInstance = workflowInstance;
    this.workflowPayload = workflowPayload; // private, use this.payload instead
    this.workflowStatus = workflowStatus;
    this.state = stepState;
    this.step = step;
    this.reporter = stepReporter;
    this.config = new StepConfig(this.step.configs);
    this.payload = this.buildPayload(workflowPayload, step);

    const getterDelegate = new KeyGetterDelegate(
      async (key) => {
        let value = await this.payload.getValue(key);
        if (_.isNil(value)) {
          const rawConfig = await this.config.spread();
          value = rawConfig[key];
        }
        return value;
      },
      { storeTitle: 'Merged Payload and Config for Step' },
    );
    this.payloadOrConfig = {};
    Object.assign(this.payloadOrConfig, getterDelegate.getMethods());

    const rawWorkflowMeta = workflowPayload.meta || {};
    const getterDelegateForMeta = new KeyGetterDelegate(async (key) => rawWorkflowMeta[key], {
      storeTitle: 'Workflow Metadata',
    });
    this.meta = {};
    Object.assign(this.meta, getterDelegateForMeta.getMethods());
  }

  wait(seconds) {
    return new WaitDecisionBuilder(seconds);
  }

  pause(seconds) {
    return new PauseDecisionBuilder(seconds);
  }

  thenGoToStep(stepIndex) {
    return new GoToDecision(stepIndex);
  }

  thenCall(methodName, ...params) {
    return new CallDecision(new Invoker(methodName, ...params));
  }

  print(message, ...params) {
    return this.reporter.print(message, ...params);
  }

  async statusMessage(message) {
    return this.reporter.statusMessage(message);
  }

  async clearStatusMessage() {
    return this.reporter.clearStatusMessage();
  }

  async clearPreviousStepsErrors() {
    this.workflowStatus.clearErrors();
  }

  printError(error, ...params) {
    return this.reporter.printError(error, ...params);
  }

  /**
   * Returns a plain JavaScript object containing all key/value passed in the "meta"
   * @returns {Promise<[unknown]>}
   */
  async toMetaContent() {
    return this.workflowPayload.meta || {};
  }

  /**
   * Returns a plain JavaScript object containing all key/value accumulated in the workflow payload so far
   * @returns {Promise<[unknown]>}
   */
  async toPayloadContent() {
    return this.workflowPayload.toPayloadContent();
  }

  // private
  buildPayload(workflowPayload, step) {
    const methodNames = [
      'load',
      'save',
      'string',
      'number',
      'boolean',
      'object',
      'optionalString',
      'optionalNumber',
      'optionalBoolean',
      'optionalObject',
      'getStepPayload',
    ];
    const payload = {};
    _.forEach(methodNames, (name) => {
      payload[name] = workflowPayload[name].bind(workflowPayload);
    });

    payload.getValue = async (key) => {
      return workflowPayload.getValue(key);
    };

    payload.setKey = async (key, value) => {
      const stepPayload = await workflowPayload.getStepPayload(step);
      return stepPayload.setKey(key, value);
    };

    payload.removeKey = async (key, { limited = false } = {}) => {
      const stepPayload = await workflowPayload.getStepPayload(step);
      if (limited) return stepPayload.removeKey(key);
      return workflowPayload.removeKey(key);
    };

    payload.removeAllKeys = async ({ limited = false } = {}) => {
      const stepPayload = await workflowPayload.getStepPayload(step);
      if (limited) return stepPayload.removeAllKeys();
      return workflowPayload.removeAllKeys();
    };

    return payload;
  }
}

module.exports = StepBase;
