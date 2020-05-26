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
import { types } from 'mobx-state-tree';

const App = types
  .model('BaseApp', {
    userAuthenticated: false,
  })
  .actions(() => ({
    // I had issues using runInAction from mobx
    // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
    runInAction(fn) {
      return fn();
    },
  }))
  .actions(self => ({
    init: async payload => {
      const tokenNotExpired = _.get(payload, 'tokenInfo.status') === 'notExpired';
      if (tokenNotExpired) {
        self.setUserAuthenticated(true);
      }
    },

    setUserAuthenticated(flag) {
      self.userAuthenticated = flag;
    },

    // this method is called by the Cleaner
    cleanup() {
      self.setUserAuthenticated(false);
    },
  }));

function registerContextItems(appContext) {
  appContext.app = App.create({}, appContext);
}

export { App, registerContextItems };
