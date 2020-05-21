const Invoker = require('../invoker');
const WaitDecision = require('./wait-decision');

class WaitDecisionBuilder {
  constructor(seconds) {
    this.waitDecision = new WaitDecision();
    this.waitDecision.seconds = seconds;
  }

  until(methodName, ...params) {
    this.waitDecision.check = new Invoker(methodName, ...params);
    return this;
  }

  maxAttempts(max) {
    this.waitDecision.max = max;
    this.waitDecision.counter = max;
    return this;
  }

  thenCall(methodName, ...params) {
    this.waitDecision.thenCall = new Invoker(methodName, ...params);
    return this;
  }

  otherwiseCall(methodName, ...params) {
    this.waitDecision.otherwise = new Invoker(methodName, ...params);
    return this;
  }

  toWaitDecision() {
    // lets do a quick validation
    if (this.waitDecision.max !== undefined && this.waitDecision.check === undefined) {
      throw new Error(
        'The step specified a wait decision with a max attempt but without specifying the "until" function.',
      );
    }

    if (this.waitDecision.max === undefined && this.waitDecision.check !== undefined) {
      throw new Error(
        'The step specified a wait decision with the "until" function but without specifying "maxAttempts" count.',
      );
    }

    if (this.waitDecision.otherwiseCall !== undefined && this.waitDecision.check === undefined) {
      throw new Error('The step specified "otherwiseCall" function but without specifying the "until" function.');
    }
    return this.waitDecision;
  }
}

module.exports = WaitDecisionBuilder;
