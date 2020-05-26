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
const WorkflowStatus = require('./workflow-status');
const EventDelegate = require('./helpers/event-delegate');

// A convenient map to shorten and un-shorten the state label
const stateLabelMap = { s: 'start', w: 'wait', pa: 'pause', l: 'loop', p: 'pass', f: 'fail' };
const stateLabels = {
  encode(long) {
    const map = _.invert(stateLabelMap);
    return map[long] || 'f'; // if we can't encode it, then it is 'fail'
  },

  decode(short) {
    const map = stateLabelMap;
    return map[short] || 'start'; // if we can't decode it, then it is 'start'
  },
};

// Supported events
const supportedEvents = [
  'workflowStarted',
  'workflowPaused',
  'workflowResuming',
  'workflowIsEmpty',
  'workflowPassed',
  'workflowFailed',
  'beforeWorkflowTick',
  'afterWorkflowTick',
];

// The class WorkflowLoop contains the main tick() logic
// --------------------------------------------------
// WorkflowLoop
// --------------------------------------------------
// The memento shape is:
// {
//   "st": "s|w|l|p|f", // state label, used by the workflowLoop to determine where it is
//                      // s=start, w=wait, l=loop, p=pass, f=fail
//   "ws": {...},       // "ws" = WorkflowStatus memento
// }
class WorkflowLoop {
  constructor({ workflowInstance, stepLoopProvider }) {
    this.workflowInstance = workflowInstance;
    this.stepLoopProvider = stepLoopProvider;
    this.workflowStatus = new WorkflowStatus({ workflowInstance });
    this.stepLoopProvider.setWorkflowStatus(this.workflowStatus);
    this.stepsCount = _.size(this.workflowInstance.steps);
    this.eventDelegate = new EventDelegate({ supportedEvents, sponsorName: 'WorkflowLoop' });
  }

  setMemento({ st = 's', ws = {} } = {}) {
    this.stateLabel = stateLabels.decode(st);
    this.workflowStatus.setMemento(ws);
    return this;
  }

  getMemento() {
    return {
      st: stateLabels.encode(this.stateLabel),
      ws: this.workflowStatus.getMemento(),
    };
  }

  async tick() {
    this.stepLoop = undefined;
    return this.catchAndReport(async () => {
      const { stateLabel, stepLoopProvider } = this;

      switch (stateLabel) {
        case 'start':
          await this.fireEvent('workflowStarted');
          this.stepLoop = await stepLoopProvider.getStepLoop();
          if (_.isEmpty(this.stepLoop)) {
            // this means that we have a workflow without any steps information
            await this.fireEvent('workflowIsEmpty');
            return this.passDecision();
          }
          break;
        case 'wait':
        case 'pause':
          this.stepLoop = await stepLoopProvider.getStepLoop();
          break;
        case 'loop':
          this.stepLoop = await stepLoopProvider.getStepLoop();
          break;
        case 'pass':
          throw new Error('Trying to run a workflow loop that has already passed.');
        case 'fail':
          throw new Error('Trying to run a workflow loop that has already failed.');
        default:
          throw new Error(`The workflowLoop has an unsupported "${stateLabel}" state label.`);
      }

      if (_.isUndefined(this.stepLoop)) throw new Error('No step loop is found.');

      const decision = await this.stepLoop.tick();
      if (_.isEmpty(decision) || !_.isObject(decision))
        throw new Error(`The current step ${this.stepLoop.logPrefixStr} didn't return a decision object.`);
      return this.processStepLoopDecision(decision, this.stepLoop);
    });
  }

  on(name, fn) {
    this.eventDelegate.on(name, fn);
    return this;
  }

  // private
  async processStepLoopDecision(decision, stepLoop) {
    const type = decision.type;

    switch (type) {
      case 'wait':
        return this.waitDecision(decision.wait);
      case 'pause':
        return this.pauseDecision(decision.wait);
      case 'goto':
        return this.goToStep(decision.stepIndex);
      case 'pass':
        return this.eitherLoopOrPass();
      case 'loop':
        return this.loopDecision();
      case 'fail':
        return this.eitherFailOrLoopOrPass(_.omit(decision, ['type']));
      default:
        throw new Error(`The current step ${stepLoop.logPrefixStr} returned an invalid decision type "${type}".`);
    }
  }

  // private
  async catchAndReport(fn) {
    let afterWorkflowTickCalled = false;
    try {
      await this.fireEvent('beforeWorkflowTick');
      const result = await fn();
      if (_.isEmpty(result)) throw new Error('No results were returned when running one workflow loop tick.');
      afterWorkflowTickCalled = true;
      await this.fireEvent('afterWorkflowTick');
      return result;
    } catch (error) {
      if (!afterWorkflowTickCalled) await this.fireEvent('afterWorkflowTick');
      return this.eitherFailOrLoopOrPass(error);
    }
  }

  // private
  // We check with the step loop provider if there is a next step loop, if that is the case
  // then we make a loopDecision otherwise we make a passDecision to end the workflow loop
  async eitherLoopOrPass() {
    const { stepLoopProvider } = this;
    // when a step is passed, we move to the next one in the next tick, if there are more step loops
    await stepLoopProvider.next(); // advance to the next stepLoop
    const stepLoop = await stepLoopProvider.getStepLoop();
    if (_.isEmpty(stepLoop)) {
      // this means that we are done, there are no more steps to run
      return this.passDecision();
    }
    return this.loopDecision();
  }

  // private
  async goToStep(stepIndex) {
    const { stepLoopProvider } = this;
    // when a step has requested workflow to go to a specific step, we move to the specified step in the next tick
    await stepLoopProvider.goToStep(stepIndex); // navigate to the specified stepLoop
    const stepLoop = await stepLoopProvider.getStepLoop();
    if (_.isEmpty(stepLoop)) {
      // this means that the "stepIndex" specified here to go to points to a non existent step
      throw new Error('Trying to go to a non-existent workflow step.');

      // TODO: May be this can be treated as a request to terminate workflow.
      //  If yes, instead of throwing error here, we can create new termination decision and return that from here
    }

    // The goto decision in workflow-loop manifests itself as loopDecision to the main loop
    // (i.e., to the workflow loop runner) so return loopDecision from here
    return this.loopDecision();
  }

  // private
  // We increment the error counter, if the error counter is more than the steps, then we make a failDecision
  // to avoid an infinite loop, otherwise we do either a loopDecision or passDecision depending on if we have
  // more step loops to process
  async eitherFailOrLoopOrPass(error = {}) {
    const { workflowStatus, stepLoop, stepsCount } = this;
    workflowStatus.addError(error, stepLoop);

    if (workflowStatus.errorCount > stepsCount) {
      // we do this to avoid a possible infinite loop
      const tooManyErrors = new Error(
        `Too many errors (more than the number of steps "${stepsCount}") inside the workflow loop. Exiting.`,
      );
      return this.failDecision(tooManyErrors);
    }

    return this.eitherLoopOrPass();
  }

  // private
  async fireEvent(name, ...params) {
    return this.eventDelegate.fireEvent(name, ...params);
  }

  // private
  async passDecision() {
    if (this.stateLabel === 'pause') {
      // if the previous state of the workflow was paused and now it is transitioning to "pass"
      // then it means the workflow is not paused any more and is resuming execution
      // fire "workflowResuming" event to notify any listeners for this transition
      await this.fireEvent('workflowResuming');
    }

    // Before we make this decision we need to see if we have errors in the workflowStatus, if so, then we change the decision
    // to failDecision picking the last error
    const { workflowStatus } = this;
    if (workflowStatus.hasErrors()) {
      return this.failDecision(workflowStatus.lastError);
    }
    await this.fireEvent('workflowPassed');
    this.stateLabel = 'pass';
    return { type: 'pass' };
  }

  // private
  async waitDecision(waitInSeconds = 1) {
    this.stateLabel = 'wait';
    return { type: 'wait', wait: waitInSeconds };
  }

  // private
  async pauseDecision(waitInSeconds = 1) {
    await this.fireEvent('workflowPaused');

    this.stateLabel = 'pause';
    return { type: 'pause', wait: waitInSeconds };
  }

  // private
  async loopDecision() {
    if (this.stateLabel === 'pause') {
      // if the previous state of the workflow was paused and now it is transitioning to "loop"
      // then it means the workflow is not paused any more and is resuming execution
      // fire "workflowResuming" event to notify any listeners for this transition
      await this.fireEvent('workflowResuming');
    }
    this.stateLabel = 'loop';
    return { type: 'loop' };
  }

  // private
  async failDecision(error) {
    const normalized = normalizeError(error);
    await this.fireEvent('workflowFailed', normalized);
    this.stateLabel = 'fail';
    return { ...normalized, type: 'fail' };
  }
}

module.exports = WorkflowLoop;
