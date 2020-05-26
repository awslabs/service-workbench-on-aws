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

const DefaultStepLoop = require('./step-loop');
const EventDelegate = require('../helpers/event-delegate');
const { catchIfErrorAsync } = require('../helpers/utils');

// Supported events
const supportedEvents = ['stepLoopCreated'];

// The memento shape is:
// {
//    "ci": int     // "ci" = current index, the index of the current step in the list of steps for this workflow
//    "sl": {...}   // "sl" = stepLoop memento (if there is a current stepLoop)
// }
class StepLoopProvider {
  constructor({ workflowInstance, stepClassProvider, StepLoopClass = DefaultStepLoop, RemoteStepLoopClass } = {}) {
    // workflowStatus is be provided by the workflow loop via setWorkflowStatus()
    this.steps = workflowInstance.steps;
    this.stepClassProvider = stepClassProvider;
    this.currentIndex = 0;
    this.eventDelegate = new EventDelegate({ supportedEvents, sponsorName: 'StepLoopProvider' });
    this.StepLoop = StepLoopClass; // StepLoop is a class
    this.RemoteStepLoop = RemoteStepLoopClass; // RemoteStepRunner is a class
  }

  setMemento({ ci = 0, sl = {} } = {}) {
    this.currentIndex = ci;
    this.stepLoopMemento = sl;
    if (this.stepLoop !== undefined) {
      this.stepLoop.setMemento(sl);
    }
    return this;
  }

  getMemento() {
    const output = {
      ci: this.currentIndex,
    };

    if (this.stepLoop !== undefined) {
      output.sl = this.stepLoop.getMemento();
    }
    return output;
  }

  setWorkflowStatus(workflowStatus) {
    this.workflowStatus = workflowStatus;
  }

  on(name, fn) {
    this.eventDelegate.on(name, fn);
    return this;
  }

  async next() {
    delete this.stepLoop;
    delete this.stepLoopMemento;
    this.currentIndex += 1;
  }

  async goToStep(stepIndex) {
    delete this.stepLoop;
    delete this.stepLoopMemento;
    if (stepIndex < 0 && stepIndex >= this.steps.length) {
      throw new Error(
        `Invalid stepIndex specified to go to. There is no step at the specified stepIndex = ${stepIndex}`,
      );
    }
    this.currentIndex = stepIndex;
  }

  async getStepLoop() {
    const { steps = [], workflowStatus, currentIndex, stepClassProvider, StepLoop, RemoteStepLoop } = this;

    if (currentIndex >= steps.length) {
      delete this.stepLoop;
      return undefined; // no more steps in the workflow
    }

    const step = steps[currentIndex];
    let stepLoop;

    if (step.remote) {
      stepLoop = new RemoteStepLoop({ step, stepClassProvider, workflowStatus });
    } else {
      stepLoop = new StepLoop({ step, stepClassProvider, workflowStatus });
    }

    if (this.stepLoopMemento !== undefined) stepLoop.setMemento(this.stepLoopMemento);
    this.stepLoop = stepLoop;

    await catchIfErrorAsync(async () => this.fireEvent('stepLoopCreated', stepLoop));
    return stepLoop;
  }

  // private
  async fireEvent(name, ...params) {
    return this.eventDelegate.fireEvent(name, ...params);
  }
}

module.exports = StepLoopProvider;
