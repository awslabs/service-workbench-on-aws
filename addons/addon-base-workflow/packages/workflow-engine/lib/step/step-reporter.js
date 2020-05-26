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

const { normalizeError, catchIfError } = require('../helpers/utils');

// --------------------------------------------------
// StepReporter
// --------------------------------------------------
class StepReporter {
  constructor({ workflowReporter, step }) {
    this.workflowReporter = workflowReporter;
    this.step = step;
    this.log = workflowReporter.log || console;
    this.logPrefixObj = { ...workflowReporter.logPrefixObj, ...step.logPrefixObj };
  }

  async stepStarted() {
    this.printStepInformation('StepLoop - step started');
  }

  async stepSkipped() {
    this.print('StepLoop - step skipped');
  }

  async stepPassed() {
    this.print('StepLoop - step completed');
  }

  async stepPaused(reasonForPause) {
    this.print(`StepLoop - step paused, Reason: ${reasonForPause}`);
  }

  async stepResumed(reasonForResume) {
    this.print(`StepLoop - step resumed, Reason: ${reasonForResume}`);
  }

  // error is just an object (not necessarily an instance of Error) with the following two properties:
  // - message & stack
  async stepFailed(error) {
    this.printError(error);
    this.print('StepLoop - step failed');
  }

  async statusMessage(message) {
    this.print(message);
  }

  async clearStatusMessage() {
    // empty implementation
  }

  // prints step information such as src
  printStepInformation(msg = 'Step information', ...params) {
    const { workflowReporter } = this;
    const obj = Object.assign({}, workflowReporter.logPrefixObj, this.step.info, { msg }, ...params);
    this.logIt(obj);
  }

  print(msg, ...params) {
    const obj = Object.assign({}, this.logPrefixObj, { msg }, ...params);
    this.logIt(obj);
  }

  printError(raw = {}, ...params) {
    const error = normalizeError(raw, { maxStackLength: 1000 });
    this.log.error(raw);
    const obj = Object.assign(
      {},
      this.logPrefixObj,
      {
        msg: error.msg || error.message || 'Unknown error',
        stack: error.stack,
      },
      error,
      ...params,
    );

    this.logItError(_.omit(obj, ['message']));
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

module.exports = StepReporter;
