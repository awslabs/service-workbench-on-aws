const Invoker = require('../invoker');
const PauseDecision = require('./pause-decision');

class PauseDecisionBuilder {
  constructor(seconds) {
    this.pauseDecision = new PauseDecision();
    this.pauseDecision.seconds = seconds;
  }

  until(methodName, ...params) {
    this.pauseDecision.check = new Invoker(methodName, ...params);
    return this;
  }

  maxAttempts(max) {
    this.pauseDecision.max = max;
    this.pauseDecision.counter = max;
    return this;
  }

  thenCall(methodName, ...params) {
    this.pauseDecision.thenCall = new Invoker(methodName, ...params);
    return this;
  }

  otherwiseCall(methodName, ...params) {
    this.pauseDecision.otherwise = new Invoker(methodName, ...params);
    return this;
  }

  toPauseDecision() {
    // lets do a quick validation
    if (this.pauseDecision.max !== undefined && this.pauseDecision.check === undefined) {
      throw new Error(
        'The step specified a pause decision with a max attempt but without specifying the "until" function.',
      );
    }

    if (this.pauseDecision.max === undefined && this.pauseDecision.check !== undefined) {
      throw new Error(
        'The step specified a pause decision with the "until" function but without specifying "maxAttempts" count.',
      );
    }

    if (this.pauseDecision.otherwiseCall !== undefined && this.pauseDecision.check === undefined) {
      throw new Error('The step specified "otherwiseCall" function but without specifying the "until" function.');
    }
    return this.pauseDecision;
  }
}

module.exports = PauseDecisionBuilder;
