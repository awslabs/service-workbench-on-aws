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

/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
import _ from 'lodash';
import { decorate, observable, action, computed } from 'mobx';

class Operations {
  constructor() {
    this.ops = [];
    this.status = 'notStarted'; // this is the overall status for all operations
    this.payload = {};
  }

  add(op) {
    this.ops.push(op);
  }

  async run(payload) {
    if (this.status === 'running') return;
    this.payload = payload;
    this.markRunning();
    for (const op of this.ops) {
      if (op.success) continue;
      if (op.running) continue;
      if (op.skipped) continue;
      await op.run(this.payload);
    }
    this.markFinished();
  }

  async rerun() {
    if (this.status === 'running') return;
    this.markNotStarted();

    this.run(this.payload);
  }

  markNotStarted() {
    this.status = 'notStarted';
  }

  markRunning() {
    this.status = 'running';
  }

  markFinished() {
    this.status = 'finished';
  }

  clear() {
    this.ops.clear();
    this.status = 'notStarted';
    this.payload = {};
  }

  get running() {
    return this.status === 'running';
  }

  get notStarted() {
    return this.status === 'notStarted';
  }

  get started() {
    return !this.notStarted;
  }

  get success() {
    if (this.status !== 'finished') return false;
    if (this.empty) return true;

    let result = true;
    // eslint-disable-next-line consistent-return
    _.forEach(this.ops, op => {
      if (op.failure) {
        result = false;
        return false; // to stop the forEach loop since we got the answer we want
      }
    });

    return result;
  }

  // If we have one or more operations that failed
  get failure() {
    if (this.status !== 'finished') return false;
    return !this.success;
  }

  // True if all operations failed (not even skipped)
  get allFailed() {
    if (this.status !== 'finished') return false;
    if (this.empty) return false;

    let result = true;
    // eslint-disable-next-line consistent-return
    _.forEach(this.ops, op => {
      if (op.success || op.skipped) {
        result = false;
        return false; // to stop the forEach loop since we got the answer we want
      }
    });

    return result;
  }

  get empty() {
    return this.ops.length === 0;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Operations, {
  ops: observable,
  status: observable,
  running: computed,
  success: computed,
  failure: computed,
  allFailed: computed,
  notStarted: computed,
  markRunning: action,
  markFinished: action,
  markNotStarted: action,
  clear: action,
});

export default Operations;
