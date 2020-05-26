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

import { getEnv, types } from 'mobx-state-tree';

import { BaseStore, isStoreReady } from '../BaseStore';
import ApiKeysStore from './ApiKeysStore';

const UserApiKeysStore = BaseStore.named('UserApiKeysStore')
  .props({
    // key = userIdentifierStr and value = ApiKeysStore for that user
    userApiKeysStores: types.optional(types.map(ApiKeysStore), {}),
  })
  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;
    return {
      async doLoad() {
        const userStore = getEnv(self).userStore;
        if (!isStoreReady(userStore)) {
          // Load current user information, if not loaded already
          await userStore.load();
        }

        const currentUser = userStore.user;
        const currentUserApiKeyStore = ApiKeysStore.create({ userIdentifierStr: currentUser.id });
        if (!isStoreReady(currentUserApiKeyStore)) {
          // Load API keys for the current user
          await currentUserApiKeyStore.load();
        }

        self.runInAction(() => {
          // The put call below will automatically use the id from currentUserApiKeyStore
          // (as it is marked "types.identifier") and add that as a key in the map and
          // store the object as value against it
          self.userApiKeysStores.put(currentUserApiKeyStore);
        });
      },
      getApiKeysStore: (userIdentifierStr, userIdentifier) => {
        let entry = self.userApiKeysStores.get(userIdentifierStr);
        if (!entry) {
          self.userApiKeysStores.put(ApiKeysStore.create({ userIdentifierStr, userIdentifier }));
          entry = self.userApiKeysStores.get(userIdentifierStr);
        }
        return entry;
      },
      getCurrentUserApiKeysStore: () => {
        const userStore = getEnv(self).userStore;
        const currentUser = userStore.user;
        return self.getApiKeysStore(currentUser.id, currentUser.identifier);
      },
      cleanup: () => {
        self.user = undefined;
        superCleanup();
      },
    };
  })
  .views(self => ({
    get empty() {
      return self.userApiKeysStores.size === 0;
    },
  }));

function registerContextItems(appContext) {
  appContext.userApiKeysStore = UserApiKeysStore.create({}, appContext);
}

export { UserApiKeysStore, registerContextItems };
