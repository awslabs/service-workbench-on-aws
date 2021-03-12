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

import { types } from 'mobx-state-tree';
import { toErr, Err } from '@aws-ee/base-ui/dist/models/Err';

// ==================================================================
// Operation
// ==================================================================
const Operation = types
  .model('Operation', {
    id: '',
    state: 'initial', // initial, processing, completed
    error: types.maybe(Err),
  })

  .actions(() => ({
    // I had issues using runInAction from mobx
    // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
    runInAction(fn) {
      return fn();
    },
  }))

  .actions(self => ({
    async run(fn) {
      self.state = 'processing';
      try {
        await fn();
        self.runInAction(() => {
          self.error = undefined;
        });
      } catch (error) {
        self.runInAction(() => {
          self.error = toErr(error);
        });
        throw error;
      } finally {
        self.runInAction(() => {
          self.state = 'completed';
        });
      }
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get initial() {
      return self.state === 'initial';
    },
    get processing() {
      return self.state === 'processing';
    },
    get completed() {
      return self.state === 'completed';
    },
    get hasError() {
      return !!self.error;
    },
    get errorMessage() {
      return self.error ? self.error.message || 'unknown error' : '';
    },
  }));

export { Operation }; // eslint-disable-line import/prefer-default-export
