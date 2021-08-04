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
import { applySnapshot, detach, getSnapshot, types } from 'mobx-state-tree';
import { addUser, updateUser, getUsers } from '@aws-ee/base-ui/dist/helpers/api';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { deleteUser, addUsers, updateUserApplication } from '../../helpers/api';
import { User } from './User';

const UsersStore = BaseStore.named('UsersStore')
  .props({
    users: types.optional(types.map(User), {}),
    tickPeriod: 60 * 1000, // 1 minute
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const users = (await getUsers()) || [];
        self.runInAction(() => {
          users.forEach(user => {
            const userModel = User.create(user);
            const previous = self.users.get(userModel.id);
            if (!previous) {
              self.users.set(userModel.id, userModel);
            } else {
              applySnapshot(previous, user);
            }
          });
        });
      },

      cleanup: () => {
        self.users.clear();
        superCleanup();
      },
      addUser: async user => {
        // if username is not specified then pass email as username
        const username = user.username || user.email;
        const addedUser = await addUser({ ...user, username });
        self.runInAction(() => {
          // Added newly created user to users map
          const addedUserModel = User.create(addedUser);
          self.users.set(addedUserModel.id, addedUserModel);
        });
      },
      addUsers: async users => {
        await addUsers(users);
      },
      updateUser: async user => {
        const updatedUser = await updateUser(user);
        const userModel = User.create(updatedUser);
        const previousUser = self.users.get(userModel.id);
        applySnapshot(previousUser, updatedUser);
      },
      updateUserApplication: async user => {
        const res = await updateUserApplication(user);
        return res;
      },
      deleteUser: async user => {
        const id = user && user.id ? user.id : User.create(user).id;
        await deleteUser(user);
        const deletedUser = self.users.get(id);
        self.runInAction(() => {
          // Detaching here instead of deleting because the ReactTable component in UsersList somehow still fires
          // "Cell" component rendering after the user is deleted from the map
          // That results in the following error
          // "You are trying to read or write to an object that is no longer part of a state tree. (Object type: 'User', Path upon death: "
          detach(deletedUser);
          // self.users.delete(id);
        });
        // return deletedUser;
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
        const user = self.users.get(userIdentifier.uid);
        return user || User.create({ username: userIdentifier.username, ns: userIdentifier.ns });
      }
      return undefined;
    },

    asUserObjects(userIdentifiers = []) {
      const result = [];
      userIdentifiers.forEach(userIdentifier => {
        if (userIdentifier) {
          const user = self.users.get(userIdentifier.uid);
          if (user) {
            result.push(user);
          } else {
            let userSnapshot;
            try {
              userSnapshot = getSnapshot(userIdentifier);
            } catch (error) {
              // Note that user might be already deleted. In order to prevent UI from crashing log the error instead
              // and not add it to User list
              console.log(`User ${userIdentifier.uid} doesn't exist`, error);
            }
            if (userSnapshot) {
              result.push(User.create(userSnapshot));
            }
          } // this could happen in the employee is no longer active or with the company
        }
      });

      return result;
    },
  }));

function registerContextItems(appContext) {
  appContext.usersStore = UsersStore.create({}, appContext);
}

export { UsersStore, registerContextItems };
