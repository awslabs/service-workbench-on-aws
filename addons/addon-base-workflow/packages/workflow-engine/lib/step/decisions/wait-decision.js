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

class WaitDecision {
  constructor() {
    this.type = 'wait';
    this.seconds = undefined;
    this.check = undefined;
    this.thenCall = undefined;
    this.otherwise = undefined;
    this.max = undefined;
    this.counter = undefined;
  }

  // The memento shape is:
  // {
  //    "type": "wait" // the type of the decision
  //    "s": int     // "s" = seconds, this is the total wait in seconds (when applicable)
  //    "mx": int    // "mx" = max check attempts (when applicable)
  //    "co": int    // "co" = counter, used to count the check attempts (when applicable)
  //    "ch": {...}  // "ch" = check, the check invoker memento (when applicable)
  //    "ot": {...}  // "ot" = otherwise, the otherwise invoker memento  (when applicable)
  //    "tc": {...}  // "tc" = thenCall invoker memento (when applicable)
  // }

  setMemento({ s, mx, co, ch, tc, ot, wt } = {}) {
    this.seconds = s;
    this.max = mx;
    this.counter = co;
    this.title = wt;

    if (ch) this.check = new Invoker().setMemento(ch);
    if (tc) this.thenCall = new Invoker().setMemento(tc);
    if (ot) this.otherwise = new Invoker().setMemento(ot);

    return this;
  }

  getMemento() {
    const result = {
      type: 'wait',
    };

    if (this.seconds !== undefined) result.s = this.seconds;
    if (this.max !== undefined) result.mx = this.max;
    if (this.counter !== undefined) result.co = this.counter;
    if (this.check) result.ch = this.check.getMemento();
    if (this.thenCall) result.tc = this.thenCall.getMemento();
    if (this.otherwise) result.ot = this.otherwise.getMemento();

    return result;
  }

  checkNotBooleanMessage() {
    const methodName = this.getMethodName(this.check);
    return `A check function ${methodName}() did not return a boolean.`;
  }

  maxReachedMessage() {
    const methodName = this.getMethodName(this.check);
    return `A "wait" decision with its check function ${methodName}() reached its maximum number of attempts "${this.max}".`;
  }

  decrement() {
    if (this.counter !== undefined) {
      this.counter -= 1;
    }
    return this;
  }

  reachedMax() {
    if (this.max === undefined) return false;
    if (this.counter === undefined) return false;
    return this.counter <= 0;
  }

  // private
  getMethodName(invoker = {}) {
    return invoker.methodName || 'unknown';
  }

  static is(decisionMemento = {}) {
    return decisionMemento.type === 'wait';
  }
}

module.exports = WaitDecision;
