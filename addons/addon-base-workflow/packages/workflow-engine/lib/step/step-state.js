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

const KeyGetterDelegate = require('../helpers/key-getter-delegate');

class StepState {
  constructor() {
    this.content = {};
    this.dirty = false;
    this.loaded = false;
    const getterStore = new KeyGetterDelegate(async (key) => this.content[key], {
      loadFn: async (key) => this.load(key),
      storeTitle: 'Step internal state',
    });
    Object.assign(this, getterStore.getMethods());
  }

  // The memento shape is:
  // {
  //   ... state store content key/value pairs
  // }

  setMemento(content = {}) {
    this.content = content;
    return this;
  }

  getMemento() {
    return this.content;
  }

  // NOTE: all of the following methods are coming from getterStore.getMethods()
  // async string(key)
  // async number(key)
  // async boolean(key)
  // async object(key)
  // async optionalString(key, defaults)
  // async optionalNumber(key, defaults)
  // async optionalBoolean(key, defaults)
  // async optionalObject(key, defaults)

  async load() {
    // since the content is kept in the memento (for now), there is no need
    // to load the content from anywhere else
    if (this.loaded) return;
    this.loaded = true;
  }

  async save() {
    // since the content is kept in the memento (for now), there is no need
    // to save the content to anywhere else
    if (!this.dirty) return;
    this.dirty = false;
  }

  async spread() {
    return this.content;
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

module.exports = StepState;
