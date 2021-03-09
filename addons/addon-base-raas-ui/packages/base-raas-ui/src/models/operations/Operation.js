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

import _ from 'lodash';
import { decorate, observable, action, computed } from 'mobx';

let counter = 0;

/**
 * A generic class that represents an operation. This class is not meant to be instantiated directly, instead you want
 * to extend this class and provide a method named 'doRun'
 */
class Operation {
  constructor() {
    this.status = 'notStarted';
    this.error = '';
    this.privateSkipped = false;
    counter += 1;
    this.id = `${Date.now()}-${counter}`;
  }

  async run(payload) {
    try {
      this.privateSkipped = false;
      this.clearError();
      this.clearMessage();
      this.markRunning();
      await this.doRun(payload);
      this.markFinished();
    } catch (error) {
      this.setError(error);
      this.markFinished();
    }
  }

  markRunning() {
    this.status = 'running';
  }

  markFinished() {
    this.status = 'finished';
  }

  markSkipped() {
    this.markFinished();
    this.privateSkipped = true;
  }

  clearError() {
    this.error = '';
  }

  setError(error) {
    if (_.isString(error)) this.error = error;
    else this.error = error.message;
  }

  setMessage(message = '') {
    this.message = message;
  }

  clearMessage() {
    this.message = '';
  }

  get running() {
    return this.status === 'running';
  }

  get hasError() {
    return this.error !== '';
  }

  get skipped() {
    return !this.failure && this.status === 'finished' && this.privateSkipped;
  }

  get success() {
    return this.status === 'finished' && !this.hasError && !this.privateSkipped;
  }

  get failure() {
    return this.status === 'finished' && this.hasError;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Operation, {
  id: observable,
  status: observable,
  message: observable,
  error: observable,
  running: computed,
  hasError: computed,
  success: computed,
  failure: computed,
  skipped: computed,
  markRunning: action,
  markFinished: action,
  markSkipped: action,
  clearError: action,
  setError: action,
  clearMessage: action,
  setMessage: action,
});

export default Operation;
