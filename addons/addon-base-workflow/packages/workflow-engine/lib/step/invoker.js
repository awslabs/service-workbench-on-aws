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

// The memento shape is:
// {
//   "m": string      // "m" = method name
//   "p": json string // "p" = parameters in json
// }
class Invoker {
  constructor(methodName, ...params) {
    this.methodName = methodName;
    const result = [];
    _.forEach([...params], item => {
      if (item instanceof Error) {
        const obj = {};
        _.forEach(Object.keys(item), key => {
          obj[key] = item[key];
        });
        Object.getOwnPropertyNames(item).forEach(key => {
          obj[key] = item[key];
        });

        result.push(obj);
      } else result.push(item);
    });
    this.params = JSON.stringify(result);
  }

  setMemento({ m, p = '[]' }) {
    this.methodName = m;
    this.params = p;

    return this;
  }

  getMemento() {
    return {
      m: this.methodName,
      p: this.params,
    };
  }

  async invoke(stepImplementation, ...rightParams) {
    if (!this.methodName) return undefined;
    const leftParams = JSON.parse(this.params);
    const fn = stepImplementation[this.methodName];
    if (!_.isFunction(fn)) throw new Error(`Was trying to call ${this.methodName}(), but this method is not defined.`);
    return fn.call(stepImplementation, ...leftParams, ...rightParams);
  }
}

module.exports = Invoker;
