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

import { getUser } from '../../helpers/api';
import { BaseStore } from '../BaseStore';
import { User } from './User';

const UserStore = BaseStore.named('UserStore')
  .props({
    user: types.maybe(User),
  })
  .actions((self) => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const user = await getUser();
        self.runInAction(() => {
          self.user = User.create(user);
        });
      },
      cleanup: () => {
        self.user = undefined;
        superCleanup();
      },
    };
  })

  .views((self) => ({
    get empty() {
      return _.isEmpty(self.user);
    },
  }));

function registerContextItems(appContext) {
  appContext.userStore = UserStore.create({}, appContext);
}

export { UserStore, registerContextItems };
