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
