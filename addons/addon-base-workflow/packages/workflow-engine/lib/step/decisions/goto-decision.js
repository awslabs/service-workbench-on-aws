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

/**
 * A decision to go to a specific step in the workflow and execute workflow from that step.
 */
class GoToDecision {
  constructor(stepIndex) {
    this.type = 'goto';
    this.stepIndex = stepIndex;
  }

  // The memento shape is:
  // {
  //    "type": "goto" // the type of the decision
  //    "si": Number  // "si" = stepIndex
  // }

  setMemento({ si } = {}) {
    this.stepIndex = si;
    return this;
  }

  getMemento() {
    const result = {
      type: 'goto',
      si: this.stepIndex,
    };
    return result;
  }

  static is(decisionMemento = {}) {
    return decisionMemento.type === 'goto';
  }
}

module.exports = GoToDecision;
