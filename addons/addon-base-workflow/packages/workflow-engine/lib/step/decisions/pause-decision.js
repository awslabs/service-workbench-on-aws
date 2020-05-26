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

const WaitDecision = require('./wait-decision');

/**
 * A decision to pause Step. This decision is very similar to the WaitDecision.
 * The WaitDecision is intended to be used for situation when the Step is in-progress and waiting for some condition
 * to become true. From StepLoop's perspective the Step is considered to be still in-progress while waiting so
 * the StepLoop does not fire any status change related events.
 *
 * In case of the PauseDecision the Step is considered to be transitioning from "in_progress" status to a explicitly
 * "paused" state. From StepLoop's perspective the Step is considered to be transitioning from "in_progress" to
 * "paused" status so the StepLoop fires step status change related events. See "../step-loop.js" for more details.
 */
class PauseDecision extends WaitDecision {
  constructor() {
    super();
    this.type = 'pause';
    this.pauseReason = '';
  }

  // The memento shape is:
  // {
  //    "type": "pause" // the type of the decision
  //    "s": int     // "s" = seconds, this is the total wait in seconds (when applicable)
  //    "mx": int    // "mx" = max check attempts (when applicable)
  //    "co": int    // "co" = counter, used to count the check attempts (when applicable)
  //    "ch": {...}  // "ch" = check, the check invoker memento (when applicable)
  //    "ot": {...}  // "ot" = otherwise, the otherwise invoker memento  (when applicable)
  //    "tc": {...}  // "tc" = thenCall invoker memento (when applicable)
  //    "pr": string  // "pr" = reason for pausing the step
  // }

  setMemento({ s, mx, co, ch, tc, ot, wt, pr } = {}) {
    super.setMemento({ s, mx, co, ch, tc, ot, wt });
    this.pauseReason = pr;
    return this;
  }

  getMemento() {
    const result = super.getMemento();
    result.type = 'pause';

    if (this.pauseReason !== undefined) result.pr = this.pauseReason;

    return result;
  }

  static is(decisionMemento = {}) {
    return decisionMemento.type === 'pause';
  }
}

module.exports = PauseDecision;
