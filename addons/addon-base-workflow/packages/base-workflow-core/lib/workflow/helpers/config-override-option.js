const _ = require('lodash');

class ConfigOverrideOption {
  constructor(overrideOption = {}) {
    this.overrideOption = overrideOption;
    this.configs = (overrideOption.allowed || []).slice();
  }

  // Returns an array of the names of all the violated configs because they are being overridden
  violatedConfigs(overridingConfig = {}, srcConfig = {}) {
    const result = [];

    const keys = Object.keys(overridingConfig);

    _.forEach(keys, key => {
      if (this.configs.includes(key)) return;
      if (!_.isEqual(overridingConfig[key], srcConfig[key])) result.push(key);
    });

    return result;
  }
}

module.exports = ConfigOverrideOption;
