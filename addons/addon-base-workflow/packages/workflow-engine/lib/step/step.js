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

// This class is a wrapper over the WorkflowSelectedStep json object
class Step {
  // index: the position of this step in the workflow
  // workflowSelectedStep: the json object containing information about this step
  constructor({ index, workflowSelectedStep } = {}) {
    this.index = index;
    this.selectedStep = workflowSelectedStep;
  }

  // step template id
  get stepTemplateId() {
    return this.selectedStep.stepTemplateId;
  }

  // step template version
  get stepTemplateVer() {
    return this.selectedStep.stepTemplateVer;
  }

  get title() {
    return this.selectedStep.title || '';
  }

  get skippable() {
    const value = this.selectedStep.skippable;
    if (_.isNil(value)) return true; // default is true
    return value;
  }

  get src() {
    return this.selectedStep.src || {};
  }

  // is the step implementation a lambda instead of a builtin implementation
  get remote() {
    return !_.isEmpty(this.src.lambdaArn);
  }

  get lambdaArn() {
    return this.src.lambdaArn;
  }

  get overrides() {
    return this.selectedStep.overrides;
  }

  get configs() {
    return this.selectedStep.configs;
  }

  // a shorthand for step template id
  get stpTmplId() {
    return this.stepTemplateId;
  }

  get stpTmplVer() {
    return this.stepTemplateVer;
  }

  get stpIndex() {
    return this.index;
  }

  get stpTitle() {
    return this.title;
  }

  get logPrefixStr() {
    return `["${this.stpIndex}"]["${this.stpTmplId}"]["${this.stpTmplVer}"]`;
  }

  get logPrefixObj() {
    return { stpIndex: this.index, stpTmplId: this.stepTemplateId, stpTmplVer: this.stepTemplateVer };
  }

  get info() {
    return _.pick(this, ['stpIndex', 'stpTmplId', 'stpTmplVer', 'stpTitle', 'src', 'configs', 'overrides']);
  }
}

module.exports = Step;
