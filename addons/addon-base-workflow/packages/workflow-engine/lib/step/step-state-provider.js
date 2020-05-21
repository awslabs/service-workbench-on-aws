const _ = require('lodash');

const StepState = require('./step-state');

class StepStateProvider {
  constructor() {
    this.mementosStore = {}; // key is the 'stpIndex-stpTemplateId', value is the memento for the step state store
    this.storeInstances = {}; // key is the 'stpIndex-stpTemplateId', value is the step state store instance
  }

  // The memento shape is:
  // {
  //   "ms": {...} // "ms" = mementos store,
  //                   where key is the 'stpIndex-stpTemplateId', value is the memento for the step state store
  // }

  setMemento({ ms = {} } = {}) {
    this.mementosStore = ms;
    this.storeInstances = {};
    return this;
  }

  getMemento() {
    const ms = { ...this.mementosStore };

    _.forEach(this.storeInstances, (store, storeId) => {
      ms[storeId] = store.getMemento();
    });

    return { ms };
  }

  async getStepState({ step }) {
    const storeId = this.getMementoKey(step);
    const existing = this.storeInstances[storeId];
    if (existing) return existing;

    const memento = this.mementosStore[storeId] || {};
    const store = new StepState();
    store.setMemento(memento);
    this.storeInstances[storeId] = store;

    return store;
  }

  // private
  getMementoKey(step) {
    return `${step.stpIndex}-${step.stpTmplId}`;
  }
}

module.exports = StepStateProvider;
