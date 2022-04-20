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

const Service = require('@amzn/base-services-container/lib/service');

class SettingsService extends Service {
  constructor(settings) {
    super();
    this._original = settings;
  }

  get entries() {
    return this._original.entries;
  }

  set(key, value) {
    this._original.set(key, value);
  }

  get(key) {
    return this._original.get(key);
  }

  getObject(key) {
    return this._original.getObject(key);
  }

  getBoolean(key) {
    return this._original.getBoolean(key);
  }

  getNumber(key) {
    return this._original.getNumber(key);
  }

  optional(key, defaultValue) {
    return this._original.optional(key, defaultValue);
  }

  optionalObject(key, defaultValue) {
    return this._original.optionalObject(key, defaultValue);
  }

  optionalNumber(key, defaultValue) {
    return this._original.optionalNumber(key, defaultValue);
  }

  optionalBoolean(key, defaultValue) {
    return this._original.optionalBoolean(key, defaultValue);
  }
}

module.exports = SettingsService;
