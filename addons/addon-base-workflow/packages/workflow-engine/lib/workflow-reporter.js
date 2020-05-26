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

const { normalizeError, catchIfError } = require('./helpers/utils');
const StepReporter = require('./step/step-reporter');

// --------------------------------------------------
// WorkflowReporter
// --------------------------------------------------
class WorkflowReporter {
  constructor({ workflowInstance = {}, log = console }) {
    this.wfInstance = workflowInstance;
    this.log = log;
    this.logPrefixObj = workflowInstance.logPrefixObj;
  }

  async workflowStarted() {
    this.printWorkflowInformation('WorkflowLoop - workflow started');
  }

  async workflowPaused() {
    this.printWorkflowInformation('WorkflowLoop - workflow paused');
  }

  async workflowResuming() {
    this.printWorkflowInformation('WorkflowLoop - workflow resuming');
  }

  async workflowIsEmpty() {
    this.print('WorkflowLoop - workflow does NOT have any steps to run');
  }

  async workflowPassed() {
    this.print('WorkflowLoop - workflow passed');
  }

  // error is just an object (not necessarily an instance of Error) with the following two properties:
  // - message & stack
  async workflowFailed(error) {
    this.printError(error);
    this.print('WorkflowLoop - workflow failed');
  }

  // prints workflow information such as title, steps, etc.
  printWorkflowInformation(msg = 'Workflow information', ...params) {
    const { wfInstance } = this;
    const obj = Object.assign({}, wfInstance.info, { msg }, ...params);
    this.logIt(obj);
  }

  print(msg, ...params) {
    const obj = Object.assign({}, this.logPrefixObj, { msg }, ...params);
    this.logIt(obj);
  }

  printError(raw = {}, ...params) {
    const error = normalizeError(raw, { maxStackLength: 1000 });
    const obj = Object.assign(
      {},
      this.logPrefixObj,
      error,
      {
        logLevel: 'error',
        msg: error.msg || error.message || 'Unknown error',
        stack: error.stack,
      },
      error,
      ...params,
    );

    this.logItError(_.omit(obj, ['message']));
  }

  getStepReporter({ step }) {
    return new StepReporter({ workflowReporter: this, step });
  }

  // private
  logIt(obj) {
    catchIfError(() => this.log.info(obj));
  }

  // private
  logItError(obj) {
    catchIfError(() => this.log.error(obj));
  }
}

module.exports = WorkflowReporter;
