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
import { runInAction } from 'mobx';

import { forgetIdToken } from '../helpers/api';

// An object that captures all the clean up logic when the app is done or no jwt token
// is found.
class Cleaner {
  constructor(appContext) {
    this.appContext = appContext;
  }

  cleanup() {
    const { disposers, intervalIds } = this.appContext;

    // it is important that we start with cleaning the disposers, otherwise snapshots events will be fired
    // for cleaned stores
    let keys = _.keys(disposers);
    _.forEach(keys, key => {
      const fn = disposers[key];
      if (_.isFunction(fn)) {
        fn();
      }
      delete disposers[key];
    });

    keys = _.keys(intervalIds);
    _.forEach(keys, key => {
      const id = intervalIds[key];
      if (!_.isNil(id)) {
        clearInterval(id);
      }
      delete intervalIds[key];
    });

    runInAction(() => {
      forgetIdToken();

      _.forEach(this.appContext, obj => {
        if (obj === this) return; // we don't want to end up in an infinite loop
        if (_.isFunction(obj.cleanup)) {
          try {
            obj.cleanup();
          } catch (error) {
            console.error(error);
          }
        }
      });
    });
  }
}

function registerContextItems(appContext) {
  appContext.cleaner = new Cleaner(appContext);
}

export { Cleaner, registerContextItems };
