const Invoker = require('../invoker');

class CallDecision {
  constructor(invoker) {
    this.type = 'call';
    this.thenCall = invoker;
  }

  // The memento shape is:
  // {
  //    "type": "call" // the type of the decision
  //    "tc": {...}  // "tc" = thenCall invoker memento (when applicable)
  // }

  setMemento({ tc } = {}) {
    this.thenCall = undefined; // ensure that it is empty
    if (tc) this.thenCall = new Invoker().setMemento(tc);

    return this;
  }

  getMemento() {
    const result = {
      type: 'call',
    };
    if (this.thenCall) result.tc = this.thenCall.getMemento();

    return result;
  }

  get methodName() {
    if (this.thenCall) return this.thenCall.methodName || 'unknown method name';
    return 'unknown method name';
  }

  static is(decisionMemento = {}) {
    return decisionMemento.type === 'call';
  }
}

module.exports = CallDecision;
