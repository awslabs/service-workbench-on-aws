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

class ConfigOverrideOption {
  constructor(overrideOption = {}) {
    this.overrideOption = overrideOption;
    this.configs = (overrideOption.allowed || []).slice();
  }

  // Returns an array of the names of all the violated configs because they are being overridden
  violatedConfigs(overridingConfig = {}, srcConfig = {}) {
    const result = [];

    const keys = Object.keys(overridingConfig);

    _.forEach(keys, (key) => {
      if (this.configs.includes(key)) return;
      if (!_.isEqual(overridingConfig[key], srcConfig[key])) result.push(key);
    });

    return result;
  }
}

module.exports = ConfigOverrideOption;
