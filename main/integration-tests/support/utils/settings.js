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

/**
 * All settings used during the tests are stored here. The main advantage of having to use get/set methods
 * when accessing settings values is so that we can print an informative message when keys are missing.
 */
class Settings {
  constructor(yamlObject = {}, { sourceText = 'the yaml configuration file' } = {}) {
    this.content = _.cloneDeep(yamlObject);
    this.sourceText = sourceText;
  }

  get entries() {
    return _.cloneDeep(this.content);
  }

  set(key, value) {
    this.content[key] = value;
  }

  get(key) {
    const value = this.content[key];
    if (_.isEmpty(value) && !_.isBoolean(value))
      throw new Error(
        `The "${key}" setting value is required but it is either empty or not provided in ${this.sourceText}.`,
      );

    return value;
  }

  optional(key, defaultValue) {
    const value = this.content[key];
    if (_.isNil(value) || (_.isString(value) && _.isEmpty(value))) return defaultValue;

    return value;
  }
}

module.exports = Settings;
