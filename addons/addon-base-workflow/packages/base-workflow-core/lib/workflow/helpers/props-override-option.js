const _ = require('lodash');

class PropsOverrideOption {
  constructor(overrideOption = {}, supportedKeys = [], transformer = key => key) {
    this.overrideOption = overrideOption;
    this.supportedKeys = supportedKeys;
    this.transformer = transformer;
    const props = (overrideOption.allowed || []).slice();
    this.props = props;
    // Special case for the 'steps' prop.  If it is not present, it means that the workflow can NOT choose to rearrange the steps or even
    // add different steps or remove existing steps.
    if (props.includes('steps')) {
      this.allowStepsOrderChange = true;
      delete props.steps;
    } else {
      this.allowStepsOrderChange = false;
    }
  }

  // Returns an array of the names of all the violated props because they are being overridden
  violatedProps(overridingObj = {}, srcObj = {}) {
    const result = [];

    const keys = this.supportedKeys;

    _.forEach(keys, key => {
      if (this.props.includes(key)) return;
      const transformedKey = this.transformer(key);
      const sideA = _.get(overridingObj, transformedKey);
      const sideB = _.get(srcObj, transformedKey);
      if (!_.isEqual(sideA, sideB)) result.push(key);
    });

    return result;
  }
}

module.exports = PropsOverrideOption;
