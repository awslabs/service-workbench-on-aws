const KeyGetterDelegate = require('../helpers/key-getter-delegate');

class StepConfig {
  constructor(configs = {}) {
    this.configs = configs;
    const getterDelegate = new KeyGetterDelegate(async key => this.configs[key], { storeTitle: 'Step configuration' });
    Object.assign(this, getterDelegate.getMethods());
  }

  async spread() {
    return this.configs;
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
}

module.exports = StepConfig;
