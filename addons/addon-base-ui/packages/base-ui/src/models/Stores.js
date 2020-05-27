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
import { decorate, observable, computed } from 'mobx';

import { isStoreLoading, isStoreReady, isStoreError } from './BaseStore';
import { swallowError } from '../helpers/utils';

// A way to load multiple stores and get the errors, etc.
class Stores {
  constructor(stores = []) {
    const result = [];
    _.forEach(stores, store => {
      if (_.isEmpty(store) || _.isNil(store)) return;
      result.push(store);
    });

    this.stores = result;
  }

  // only if they are not loaded already, you can force loading if you want
  async load({ forceLoad = false } = {}) {
    _.forEach(this.stores, store => {
      if (!forceLoad && isStoreReady(store)) return;
      swallowError(store.load());
    });
  }

  get ready() {
    let answer = true;
    _.forEach(this.stores, store => {
      answer = answer && isStoreReady(store);
    });
    return answer;
  }

  get loading() {
    let answer = false;
    _.forEach(this.stores, store => {
      if (isStoreLoading(store)) {
        answer = true;
        return false; // to stop the loop
      }
      return undefined;
    });

    return answer;
  }

  get hasError() {
    return !!this.error;
  }

  get error() {
    let error;
    _.forEach(this.stores, store => {
      if (isStoreError(store)) {
        error = store.error;
        return false; // to stop the loop
      }
      return undefined;
    });

    return error;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Stores, {
  stores: observable,
  ready: computed,
  loading: computed,
  hasError: computed,
  error: computed,
});

export default Stores;
