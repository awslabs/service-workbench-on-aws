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

const { normalizeError } = require('./helpers/utils');

class WorkflowStatus {
  constructor({ workflowInstance }) {
    this.workflowInstance = workflowInstance;
    this.errorCount = 0;
    this.errors = [];
    this.logPrefixObj = { ...workflowInstance.logPrefixObj };
  }

  // The memento shape is:
  // {
  //   "er": [ {msg, stack, wfInstId, wfId, wfVer,  stpIndex*, stpTmplId*, stpTmplVer*} ] // "er" = errors mementos
  //         // stpIndex, stpTmplId and stpTmplVer are available only if the error came from a step loop
  //   "ec": int  // "ec" = error count
  // }

  setMemento({ er = [], ec = 0 } = {}) {
    this.errorCount = ec;
    this.errors = er;
    return this;
  }

  getMemento() {
    return {
      er: this.errors.slice(),
      ec: this.errorCount,
    };
  }

  hasErrors() {
    return _.size(this.errors) > 0;
  }

  clearErrors() {
    this.errors = [];
  }

  addError(error, stepLoop) {
    this.errorCount += 1;
    let entry = { ...this.logPrefixObj, ...normalizeError(error) };
    if (stepLoop && _.isObject(stepLoop.logPrefixObj)) {
      entry = { ...stepLoop.logPrefixObj, ...entry };
    }

    this.errors.push(entry);
  }

  get lastError() {
    if (_.isEmpty(this.errors)) return {};
    return this.errors[this.errors.length - 1];
  }
}

module.exports = WorkflowStatus;
