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
import { applySnapshot, getSnapshot, types } from 'mobx-state-tree';

import { addUser, getUsers, updateUser } from '../../helpers/api';
import { User, getIdFromObj } from './User';
import { BaseStore } from '../BaseStore';

const UsersStore = BaseStore.named('UsersStore')
  .props({
    users: types.optional(types.map(User), {}),
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const users = (await getUsers()) || [];
        self.runInAction(() => {
          const map = {};
          users.forEach(user => {
            const userId = getIdFromObj(user);
            map[userId] = user;
          });
          self.users.replace(map);
        });
      },

      cleanup: () => {
        self.users.clear();
        superCleanup();
      },
      addUser: async user => {
        const addedUser = await addUser(user);
        self.runInAction(() => {
          // Added newly created user to users map
          const addedUserModel = User.create(addedUser);
          self.users.set(addedUserModel.id, addedUserModel);
        });
      },
      updateUser: async user => {
        const updatedUser = await updateUser(user);
        const userModel = User.create(updatedUser);
        const previousUser = self.users.get(userModel.id);
        applySnapshot(previousUser, updatedUser);
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.users.size === 0;
    },

    get hasNonRootAdmins() {
      const nonRootAdmins = _.filter(self.list, user => user.isAdmin && !user.isRootUser);
      return !_.isEmpty(nonRootAdmins);
    },

    get hasNonRootUsers() {
      return !_.isEmpty(self.nonRootUsers);
    },

    get nonRootUsers() {
      return _.filter(self.list, user => !user.isRootUser);
    },

    get list() {
      const result = [];
      // converting map self.users to result array
      self.users.forEach(user => result.push(user));
      return result;
    },

    asSelectOptions({ nonClearables = [] } = {}) {
      const result = [];
      self.users.forEach(user =>
        result.push({
          value: user.id,
          label: user.longDisplayName,
          clearableValue: !nonClearables.includes(user.id),
        }),
      );
      return result;
    },

    asDropDownOptions({ status = 'active' } = {}) {
      const result = [];
      self.users.forEach(user => {
        if (user.status === status) {
          result.push({
            key: user.id,
            value: user.id,
            text: user.longDisplayName,
          });
        }
      });
      return result;
    },

    asUserObject(userIdentifier) {
      if (userIdentifier) {
        const user = self.users.get(userIdentifier.id);
        return user || User.create({ username: userIdentifier.username, ns: userIdentifier.ns }); // this could happen in the employee is no longer active or with the company
      }
      return undefined;
    },

    asUserObjects(userIdentifiers = []) {
      const result = [];
      userIdentifiers.forEach(userIdentifier => {
        if (userIdentifier) {
          const user = self.users.get(userIdentifier.id);
          if (user) {
            result.push(user);
          } else {
            result.push(User.create(getSnapshot(userIdentifier)));
          } // this could happen in the employee is no longer active or with the company
        }
      });

      return result;
    },
  }));

function toUserIds(userObjects) {
  return _.map(userObjects, user => user.id);
}

function toLongNames(userObjects) {
  return _.map(userObjects, user => user.longDisplayName);
}

function toLongName(object) {
  if (object) {
    return object.longDisplayName;
  }
  return 'Unknown';
}

function registerContextItems(appContext) {
  appContext.usersStore = UsersStore.create({}, appContext);
}

export { UsersStore, toUserIds, toLongNames, toLongName, registerContextItems };
