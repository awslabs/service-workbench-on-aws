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
