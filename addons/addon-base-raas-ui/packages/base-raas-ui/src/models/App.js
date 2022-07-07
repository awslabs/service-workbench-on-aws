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

/* eslint-disable import/prefer-default-export */
import _ from 'lodash';
import { getEnv, getType } from 'mobx-state-tree';

function createAppType(appContext) {
  const ParentApp = getType(appContext.app);

  const AppType = ParentApp.named('RaasApp')
    .props({
      userRegistered: false,
    })
    .actions(self => {
      // save the base implementations of the parent app
      const superInit = self.init;
      const superCleanup = self.cleanup;

      return {
        init: async payload => {
          await superInit(payload);
          self.runInAction(() => {
            const userStore = getEnv(self).userStore;
            if (_.get(userStore, 'user.status') === 'active') {
              self.setUserRegistered(true);
            }
          });
        },

        setUserRegistered(flag) {
          self.userRegistered = flag;
        },

        // this method is called by the Cleaner
        cleanup() {
          self.setUserRegistered(false);
          superCleanup();
        },
      };
    });

  return AppType;
}

function registerContextItems(appContext) {
  const App = createAppType(appContext);
  appContext.app = App.create({}, appContext);
}

export { registerContextItems };
