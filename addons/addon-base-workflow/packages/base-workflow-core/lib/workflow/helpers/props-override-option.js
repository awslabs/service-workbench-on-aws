/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const _ = require('lodash');

class PropsOverrideOption {
  constructor(overrideOption = {}, supportedKeys = [], transformer = (key) => key) {
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

    _.forEach(keys, (key) => {
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
