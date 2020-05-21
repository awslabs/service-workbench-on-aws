const _ = require('lodash');

const KeyGetterDelegate = require('./helpers/key-getter-delegate');

class WorkflowInput {
  constructor({ input }) {
    this.content = input;
    const getterDelegate = new KeyGetterDelegate(async key => this.content[key], {
      storeTitle: 'Workflow input',
    });
    Object.assign(this, getterDelegate.getMethods());
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

  async hasKey(key) {
    return _.has(this.content, key);
  }

  async allKeys() {
    return _.keys(this.content);
  }

  async getValue(key) {
    return this.content[key];
  }
}

module.exports = WorkflowInput;
