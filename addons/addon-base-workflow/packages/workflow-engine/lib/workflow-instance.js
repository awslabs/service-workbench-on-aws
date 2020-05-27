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

const Step = require('./step/step');

// This class is a wrapper over the WorkflowInstance json object
class WorkflowInstance {
  // workflowInstance: the json object containing information about this workflow instance
  constructor({ workflowInstance = {} } = {}) {
    this.wfInst = workflowInstance;
    this.wf = workflowInstance.workflow || {};

    // lets prepare the Steps now
    this.steps = _.map(this.wf.selectedSteps, (entry, index) => new Step({ index, workflowSelectedStep: entry }));
  }

  get id() {
    return this.wfInst.id;
  }

  get stepAttribs() {
    return this.wfInst.stAttribs;
  }

  get workflowId() {
    return this.wf.id;
  }

  get workflowVer() {
    return this.wf.v;
  }

  get title() {
    return this.wf.title;
  }

  // a shorthand form for logging purposes
  get wfInstId() {
    return this.wfInst.id;
  }

  get wfId() {
    return this.workflowId;
  }

  get wfVer() {
    return this.workflowVer;
  }

  get wfTitle() {
    return this.title;
  }

  get logPrefixString() {
    return `["${this.wfInstId}"]["${this.wfId}"]["${this.wfVer}"]`;
  }

  get logPrefixObj() {
    return { wfInstId: this.wfInstId, wfId: this.wfId, wfVer: this.wfVer };
  }

  get info() {
    return {
      ..._.pick(this, ['wfInstId', 'wfId', 'wfVer', 'wfTitle']),
      steps: _.map(this.steps, step => ({ ...step.logPrefixObj, stpTitle: step.stpTitle, stpConfigs: step.configs })),
    };
  }
}

module.exports = WorkflowInstance;
