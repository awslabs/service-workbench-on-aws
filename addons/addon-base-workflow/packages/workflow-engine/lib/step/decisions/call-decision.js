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

const Invoker = require('../invoker');

class CallDecision {
  constructor(invoker) {
    this.type = 'call';
    this.thenCall = invoker;
  }

  // The memento shape is:
  // {
  //    "type": "call" // the type of the decision
  //    "tc": {...}  // "tc" = thenCall invoker memento (when applicable)
  // }

  setMemento({ tc } = {}) {
    this.thenCall = undefined; // ensure that it is empty
    if (tc) this.thenCall = new Invoker().setMemento(tc);

    return this;
  }

  getMemento() {
    const result = {
      type: 'call',
    };
    if (this.thenCall) result.tc = this.thenCall.getMemento();

    return result;
  }

  get methodName() {
    if (this.thenCall) return this.thenCall.methodName || 'unknown method name';
    return 'unknown method name';
  }

  static is(decisionMemento = {}) {
    return decisionMemento.type === 'call';
  }
}

module.exports = CallDecision;
