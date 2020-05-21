import _ from 'lodash';
import { applySnapshot, getSnapshot, types } from 'mobx-state-tree';
import { addUser, updateUser, getUsers } from '@aws-ee/base-ui/dist/helpers/api';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { deleteUser, addUsers, updateUserApplication } from '../../helpers/api';
import { User } from './User';

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
          users.forEach(user => {
            const userModel = User.create(user);
            const previous = self.users.get(userModel.id);
            if (!previous) {
              self.users.set(userModel.id, userModel);
            } else {
              previous.setUser(user);
            }
          });
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
        // const id = user && user.id ? user.id : User.create(user).id;
        await deleteUser(user);
        // self.runInAction(() => {
        //   self.users.delete(id);
        // });
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.users.size === 0;
    },

    get hasNonRootAdmins() {
      const nonRootAdmins = _.filter(self.list, user => user.isAdmin && !user.isRootUser);
      console.log(nonRootAdmins);
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

// function registerModels(globals) {
//   globals.usersStore = UsersStore.create({}, globals);
// }

// export { UsersStore, toUserIds, toLongNames, toLongName, registerModels };

// const UsersStore = BaseUsersStore.named('UsersStore')
//   .actions(self => {
//     return {
//       addUser: async user => {
//         const addedUser = await addUser(user);
//         self.runInAction(() => {
//           // Added newly created user to users map
//           const addedUserModel = User.create(addedUser);
//           self.users.set(addedUserModel.id, addedUserModel);
//         });
//       },
//       updateUser: async user => {
//         const updatedUser = await updateUser(user);
//         const userModel = User.create(updatedUser);
//         const previousUser = self.users.get(userModel.id);
//         applySnapshot(previousUser, updatedUser);
//       },
//       addUsers: async users => {
//         await addUsers(users);
//       },
//       updateUserApplication: async user => {
//         const res = await updateUserApplication(user);
//         return res;
//       },
//       deleteUser: async user => {
//         await deleteUser(user);
//       },
//     };
//   })

//   .views(self => ({
//     asUserObject(userIdentifier) {
//       if (userIdentifier) {
//         const user = self.users.get(userIdentifier.id);
//         return user || User.create({ username: userIdentifier.username, ns: userIdentifier.ns });
//       }
//       return undefined;
//     },

//     asUserObjects(userIdentifiers = []) {
//       const result = [];
//       userIdentifiers.forEach(userIdentifier => {
//         if (userIdentifier) {
//           const user = self.users.get(userIdentifier.id);
//           if (user) {
//             result.push(user);
//           } else {
//             result.push(User.create(getSnapshot(userIdentifier)));
//           }
//         }
//       });

//       return result;
//     },
//   }));

function registerContextItems(appContext) {
  appContext.usersStore = UsersStore.create({}, appContext);
}

export { UsersStore, registerContextItems };
