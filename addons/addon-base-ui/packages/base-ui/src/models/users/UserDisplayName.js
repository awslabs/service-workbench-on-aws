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
import { types, getEnv } from 'mobx-state-tree';

// A convenient model that returns the display name or long display name given a user identifier
const UserDisplayName = types.model('UserDisplayName', {}).views(self => ({
  getDisplayName({ uid }) {
    let userStore;

    if (_.isUndefined(uid)) {
      userStore = getEnv(self).userStore;
      if (userStore.user) return userStore.displayName;
      return 'Unknown';
    }

    if (uid === '_system_') return 'System';

    const usersStore = getEnv(self).usersStore;
    const user = usersStore.asUserObject({ uid });

    if (_.isUndefined(user)) return 'unknown';
    return user.displayName || 'unknown';
  },

  // identifier: can be an instance of '_system_', other string or undefined
  getLongDisplayName(identifier) {
    let userStore;

    if (_.isUndefined(identifier)) {
      userStore = getEnv(self).userStore;
      if (userStore.user) return userStore.longDisplayName;
      return 'Unknown';
    }

    if (identifier === '_system_') return 'System';

    const usersStore = getEnv(self).usersStore;
    const user = usersStore.asUserObject(identifier);

    if (_.isUndefined(user)) return 'unknown';
    return user.longDisplayName || 'unknown';
  },

  // identifier: can be an instance of '_system_', other string or undefined
  isSystem(identifier) {
    let userStore;

    if (_.isUndefined(identifier)) {
      userStore = getEnv(self).userStore;
      if (userStore.user) return userStore.user.isSystem;
      return false;
    }

    if (identifier === '_system_') return true;

    const usersStore = getEnv(self).usersStore;
    const user = usersStore.asUserObject(identifier);

    if (_.isUndefined(user)) return false;
    return user.isSystem;
  },
}));

function registerContextItems(appContext) {
  appContext.userDisplayName = UserDisplayName.create({}, appContext);
}

export { UserDisplayName, registerContextItems };
