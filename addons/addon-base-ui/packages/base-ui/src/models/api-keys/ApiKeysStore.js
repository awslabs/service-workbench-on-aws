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

import { getApiKeys, createNewApiKey, revokeApiKey } from '../../helpers/api';
import { BaseStore } from '../BaseStore';
import ApiKey from './ApiKey';
import UserIdentifier from '../users/UserIdentifier';

const ApiKeysStore = BaseStore.named('ApiKeysStore')
  .props({
    userIdentifierStr: types.identifier,
    userIdentifier: UserIdentifier,
    apiKeys: types.optional(types.map(ApiKey), {}),
  })
  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;
    return {
      async doLoad() {
        const username = self.userIdentifier.username;
        const ns = self.userIdentifier.ns;
        // do not pass username or ns params when loading api keys for current user
        const apiKeys = await getApiKeys(!self.isStoreForCurrentUser() && { username, ns });
        self.runInAction(() => {
          const map = {};
          apiKeys.forEach(apiKey => {
            const apiKeyModel = ApiKey.create(apiKey);
            map[apiKeyModel.id] = apiKeyModel;
          });
          self.apiKeys.replace(map);
        });
      },
      async createNewApiKey() {
        const username = self.userIdentifier.username;
        const ns = self.userIdentifier.ns;
        const apiKey = await createNewApiKey(!self.isStoreForCurrentUser() && { username, ns });
        self.runInAction(() => {
          // The put call below will automatically use the id from ApiKey
          // (as it is marked "types.identifier") and add that as a key in the map and
          // store the object as value against it
          self.apiKeys.put(ApiKey.create(apiKey));
        });
      },
      async revokeApiKey(apiKeyId) {
        const username = self.userIdentifier.username;
        const ns = self.userIdentifier.ns;
        const apiKey = await revokeApiKey(apiKeyId, !self.isStoreForCurrentUser() && { username, ns });
        self.runInAction(() => {
          self.apiKeys.put(ApiKey.create(apiKey));
        });
      },
      cleanup: () => {
        self.user = undefined;
        superCleanup();
      },
    };
  })
  .views(self => ({
    get empty() {
      return self.apiKeys.size === 0;
    },
    get list() {
      const result = [];
      // converting map self.apiKeys to result array
      self.apiKeys.forEach(apiKey => result.push(apiKey));
      return result;
    },
    isStoreForCurrentUser: () => {
      const username = self.userIdentifier.username;
      const ns = self.userIdentifier.ns;

      const userStore = getEnv(self).userStore;
      const currentUser = userStore.user;
      return currentUser.username === username && currentUser.ns === ns;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use UserStore.apiKeysStore or UsersStore.getApiKeysStore(userIdentifier)
export default ApiKeysStore;
