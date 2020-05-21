const _ = require('lodash');

const KeyGetterDelegate = require('../helpers/key-getter-delegate');

class StepPayload {
  constructor({ step, workflowInstance }) {
    this.workflowInstance = workflowInstance;
    this.step = step;
    this.content = {};
    this.dirty = false;
    this.loaded = false;
    const getterDelegate = new KeyGetterDelegate(async key => this.content[key], {
      loadFn: async key => this.load(key),
      storeTitle: 'Step payload',
    });

    Object.assign(this, getterDelegate.getMethods());
  }

  // The memento shape is:
  // {
  //   ... step payload content key/value pairs
  // }

  setMemento(content = {}) {
    this.content = content;
    return this;
  }

  getMemento() {
    return this.content;
  }

  // NOTE: all of the following methods are coming from getterDelegate.getMethods()
  // async string(key)
  // async number(key)
  // async boolean(key)
  // async object(key)
  // async optionalString(key, defaults)
  // async optionalNumber(key, defaults)
  // async optionalBoolean(key, defaults)
  // async optionalObject(key, defaults)

  async load() {
    // since the store is kept in the memento (for now), there is no need
    // to load the store from anywhere else
    if (this.loaded) return;
    this.loaded = true;
  }

  async save() {
    // since the store is kept in the memento (for now), there is no need
    // to save the store to anywhere else
    if (!this.dirty) return;
    this.dirty = false;
  }

  async spread() {
    return this.content;
  }

  async allKeys() {
    return _.keys(this.content);
  }

  async hasKey(key) {
    return _.has(this.content, key);
  }

  async getValue(key) {
    return this.content[key];
  }

  async setKey(key, value) {
    this.content[key] = value;
    this.dirty = true;
  }

  async removeKey(key) {
    delete this.content[key];
    this.dirty = true;
  }

  async removeAllKeys() {
    this.content = {};
    this.dirty = true;
  }
}

module.exports = StepPayload;
