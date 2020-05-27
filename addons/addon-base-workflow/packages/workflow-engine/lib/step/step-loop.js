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

const { normalizeError, catchIfErrorAsync } = require('../helpers/utils');
const EventDelegate = require('../helpers/event-delegate');
const WaitDecision = require('./decisions/wait-decision');
const PauseDecision = require('./decisions/pause-decision');
const CallDecision = require('./decisions/call-decision');
const GoToDecision = require('./decisions/goto-decision');

// A convenient map to shorten and un-shorten the state label
const stateLabelMap = { s: 'start', w: 'wait', pa: 'pause', l: 'loop', p: 'pass', f: 'fail' };
const stateLabels = {
  encode(long) {
    const map = _.invert(stateLabelMap);
    return map[long] || 'f';
  },

  decode(short) {
    const map = stateLabelMap;
    return map[short] || 'start';
  },
};

// Supported events
const supportedEvents = [
  'stepLoopStarted',
  'stepLoopSkipped',
  'stepLoopMethodCall',
  'stepLoopQueueAdd',
  'stepLoopStepPausing',
  'stepLoopStepResuming',
  'stepLoopRequestingGoTo',
  'stepLoopStepMaxPauseReached',
  'stepLoopPassed',
  'stepLoopFailed',
  'beforeStepLoopTick',
  'afterStepLoopTick',
];

class StepLoop {
  constructor({ step, stepClassProvider, workflowStatus }) {
    this.step = step;
    this.stepClassProvider = stepClassProvider;
    this.workflowStatus = workflowStatus;
    this.stateLabel = 'start';
    this.decisionQueue = [];
    this.eventDelegate = new EventDelegate({ supportedEvents, sponsorName: 'StepLoop' });
  }

  // The memento shape is:
  // {
  //    "st": "s|w|pa|l|p|f", // state label
  //                       // s="start", w="wait", pa="pause", l="loop", p="pass", f="fail"
  //    "dq": [{ decision memento }, ... ] // "dq" = decision queue memento
  // }

  setMemento({ st = 's', dq = [] } = {}) {
    this.stateLabel = stateLabels.decode(st);
    const supportedDecisions = [WaitDecision, PauseDecision, CallDecision];
    this.decisionQueue = [];

    dq.forEach((decisionMemento) => {
      let found = false;
      supportedDecisions.forEach((DecisionClass) => {
        if (DecisionClass.is(decisionMemento)) {
          const decision = new DecisionClass();
          decision.setMemento(decisionMemento);
          this.decisionQueue.push(decision);
          found = true;
          return false; // stop the inner loop
        }
        return undefined;
      });
      if (!found) throw new Error(`The decision loop contains an unknown decision ${decisionMemento}.`);
    });

    return this;
  }

  getMemento() {
    const queue = []; // the memento version of the queue
    const result = {
      st: stateLabels.encode(this.stateLabel),
    };

    _.forEach(this.decisionQueue, (decision) => {
      queue.push(decision.getMemento());
    });

    result.dq = queue;
    return result;
  }

  on(name, fn) {
    this.eventDelegate.on(name, fn);
    return this;
  }

  // main user of this property is the workflow loop
  get logPrefixStr() {
    if (!this.step) return '["unknown step"]';
    return this.step.logPrefixStr;
  }

  get logPrefixObj() {
    if (!this.step) return {};
    return this.step.logPrefixObj;
  }

  async tick() {
    // we need to check if there were errors in pervious steps
    // and if so, then we start the loop for this new step only and only if step.skippable = false
    if (this.shouldSkip() && this.stateLabel === 'start') {
      await this.safeFireEvent('stepLoopSkipped');
      return this.passDecision();
    }

    return this.catchAndReport(async () => {
      const { stateLabel } = this;
      this.stepImplementation = undefined;
      let decision;

      switch (stateLabel) {
        case 'start':
          this.stepImplementation = await this.getStepImplementation();
          await this.fireEvent('stepLoopStarted');
          decision = await this.stepImplementation.start();
          return this.processStepDecision(decision);
        case 'wait':
        case 'goto':
        case 'pause':
        case 'loop':
          this.stepImplementation = await this.getStepImplementation();
          return this.processDecisionQueue();
        case 'pass':
          throw new Error('Trying to run a step loop that has already passed.');
        case 'fail':
          throw new Error('Trying to run a step loop that has already failed.');
        default:
          throw new Error(`The step loop has an unsupported "${stateLabel}" state label.`);
      }
    });
  }

  // private
  async processDecisionQueue() {
    if (this.decisionQueue.length === 0) throw new Error('No decisions in the step Loop to process.');
    const decision = this.decisionQueue[0];

    // A helper function that inserts a call decision if we have "thenCall", otherwise,
    // it returns a pass decision after calling onPass
    const thenCallOrPass = async () => {
      this.decisionQueue.shift(); // remove the first element
      if (decision.thenCall) {
        this.decisionQueue.unshift(new CallDecision(decision.thenCall));
        return this.loopDecision();
      }
      await this.callOnPass();
      return this.passDecision();
    };

    // A helper function that calls the "check" function
    const callCheckFn = async () => {
      const impl = this.stepImplementation;
      await this.safeFireEvent('stepLoopMethodCall', decision.check.methodName);
      const result = await decision.check.invoke(impl);
      if (!_.isBoolean(result)) throw new Error(decision.checkNotBooleanMessage());
      return result;
    };

    // A helper function that inserts a call decision for the "otherwise" function if it exists,
    // otherwise, it throws an exceed max attempts error
    const otherwiseOrError = async () => {
      this.decisionQueue.shift(); // remove the first element
      if (decision.otherwise) {
        this.decisionQueue.unshift(new CallDecision(decision.otherwise));
        return this.loopDecision();
      }
      throw new Error(decision.maxReachedMessage());
    };

    // The logic for processing the decision queue
    if (WaitDecision.is(decision)) {
      decision.decrement();
      if (_.isNil(decision.max)) return thenCallOrPass();
      const isTrue = await callCheckFn();
      if (isTrue) return thenCallOrPass();
      if (decision.reachedMax()) return otherwiseOrError();
      return this.waitDecision(decision.seconds);
    }

    if (PauseDecision.is(decision)) {
      decision.decrement();
      if (_.isNil(decision.max)) return thenCallOrPass();
      const isTrue = await callCheckFn();
      if (isTrue) {
        await this.safeFireEvent('stepLoopStepResuming', 'resume condition met');
        return thenCallOrPass();
      }
      if (decision.reachedMax()) {
        await this.safeFireEvent('stepLoopStepMaxPauseReached');
        return otherwiseOrError();
      }
      return this.pauseDecision(decision.seconds);
    }

    if (CallDecision.is(decision)) {
      this.decisionQueue.shift(); // remove the first element
      await this.safeFireEvent('stepLoopMethodCall', decision.methodName);
      const impl = this.stepImplementation;
      const stepDecision = await decision.thenCall.invoke(impl);
      return this.processStepDecision(stepDecision);
    }

    if (GoToDecision.is(decision)) {
      this.decisionQueue.shift(); // remove the first element
      await this.safeFireEvent('stepLoopRequestingGoTo', decision.stepIndex);
      // Call "OnPass" on current step before returning GoTo and resuming workflow from other step
      await this.callOnPass();
      return this.goToDecision(decision.stepIndex);
    }

    throw new Error(`The step loop decision queue contains an unsupported decision "${JSON.stringify(decision)}".`);
  }

  // private
  async processStepDecision(possibleDecision) {
    let decision = possibleDecision;
    let msg;

    if (_.isEmpty(possibleDecision)) {
      await this.callOnPass();
      return this.passDecision();
    }

    // lets start with the possibility that a step is returning a wait builder instance instead of an instance of a wait decision
    if (_.isFunction(possibleDecision.toWaitDecision)) {
      decision = possibleDecision.toWaitDecision();
    }
    // if not wait builder, check if the step returned an instance of pause decision builder instead of an instance
    // of pause decision
    if (_.isFunction(possibleDecision.toPauseDecision)) {
      decision = possibleDecision.toPauseDecision();
    }

    if (WaitDecision.is(decision)) {
      msg = `StepLoop - adding a wait decision for ${decision.seconds} seconds to the step loop decision queue`;
      await this.safeFireEvent('stepLoopQueueAdd', msg, decision);
      this.decisionQueue.push(decision);
      return this.waitDecision(decision.seconds);
    }

    if (PauseDecision.is(decision)) {
      msg = `StepLoop - adding a pause decision for ${decision.seconds} seconds to the step loop decision queue`;
      await this.safeFireEvent('stepLoopQueueAdd', msg, decision);
      await this.safeFireEvent('stepLoopStepPausing', decision.pauseReason);
      this.decisionQueue.push(decision);
      return this.pauseDecision(decision.seconds);
    }

    if (CallDecision.is(decision)) {
      msg = `StepLoop - adding a call decision for ${decision.methodName}() to the step loop decision queue`;
      await this.safeFireEvent('stepLoopQueueAdd', msg, decision);
      this.decisionQueue.push(decision);
      return this.loopDecision();
    }

    if (GoToDecision.is(decision)) {
      msg = `StepLoop - adding a goto decision to execute workflow from step at index ${decision.stepIndex} to the step loop decision queue`;
      await this.safeFireEvent('stepLoopQueueAdd', msg, decision);
      await this.safeFireEvent('stepLoopRequestingGoTo', decision.stepIndex);

      this.decisionQueue.push(decision);
      return this.goToDecision(decision.stepIndex);
    }

    throw new Error(`The step returned an unsupported decision/return object "${JSON.stringify(decision)}".`);
  }

  // private
  shouldSkip() {
    const hasErrors = this.workflowStatus.hasErrors();
    return hasErrors && this.step.skippable;
  }

  // private
  async getStepImplementation() {
    const { step, stepClassProvider, workflowStatus } = this;
    const impl = await stepClassProvider.getClass({ step, workflowStatus });
    if (_.isNil(impl)) throw new Error('The step does not have an implementation');
    step.implementation = impl; // create a reference to step implementation so that it can be accessed by reporter
    if (_.isFunction(impl.initStep)) await impl.initStep();
    if (!_.isFunction(impl.start)) throw new Error('The step does not have "start" method.');
    return impl;
  }

  // private
  async catchAndReport(fn) {
    let afterStepLoopTickCalled = false;

    try {
      await this.fireEvent('beforeStepLoopTick');
      const result = await fn();
      if (_.isEmpty(result)) throw new Error('No results were returned when running one step loop tick.');
      afterStepLoopTickCalled = true;
      await this.fireEvent('afterStepLoopTick');
      return result;
    } catch (error) {
      if (!afterStepLoopTickCalled) await this.fireEvent('afterStepLoopTick');
      return this.callOnFail(error);
    }
  }

  // private
  async callOnPass() {
    // clear the decision queue
    this.decisionQueue = [];
    const impl = this.stepImplementation;

    if (impl && _.isFunction(impl.onPass)) {
      await this.safeFireEvent('stepLoopMethodCall', 'onPass');
      await impl.onPass();
    }
    await this.fireEvent('stepLoopPassed');
  }

  // private
  async callOnFail(error) {
    // clear the decision queue
    this.decisionQueue = [];
    const normalized = normalizeError(error);
    const impl = this.stepImplementation;
    let stepFailedEventCalled = false;

    try {
      if (impl && _.isFunction(impl.onFail)) {
        await this.safeFireEvent('stepLoopMethodCall', 'onFail');
        await impl.onFail(error);
      }

      stepFailedEventCalled = true;
      await this.fireEvent('stepLoopFailed', normalized);
      return this.failDecision(normalized);
    } catch (error2) {
      if (!stepFailedEventCalled) await this.fireEvent('stepLoopFailed', normalizeError(error2));
      return this.failDecision(error2);
    }
  }

  // private
  async fireEvent(name, ...params) {
    return this.eventDelegate.fireEvent(name, ...params);
  }

  // private
  // Same as fireEvent but wrapped with catchIfErrorAsync. Sometime we do not want to catch the ignore the exceptions
  // from the listeners and sometime we want to do that.
  async safeFireEvent(name, ...params) {
    return catchIfErrorAsync(async () => this.fireEvent(name, ...params));
  }

  // private
  passDecision() {
    this.stateLabel = 'pass';
    return { type: 'pass' };
  }

  // private
  waitDecision(waitInSeconds = 1) {
    this.stateLabel = 'wait';
    return { type: 'wait', wait: waitInSeconds };
  }

  // private
  pauseDecision(waitInSeconds = 1) {
    this.stateLabel = 'pause';
    return { type: 'pause', wait: waitInSeconds };
  }

  // private
  goToDecision(stepIndex) {
    this.stateLabel = 'goto';
    return { type: 'goto', stepIndex };
  }

  // private
  loopDecision() {
    this.stateLabel = 'loop';
    return { type: 'loop' };
  }

  // private
  failDecision(error) {
    const normalized = normalizeError(error);
    this.stateLabel = 'fail';
    return { ...normalized, type: 'fail' };
  }
}

module.exports = StepLoop;
