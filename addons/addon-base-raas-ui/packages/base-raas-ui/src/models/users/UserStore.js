import _ from 'lodash';
import { types } from 'mobx-state-tree';

import { getUser } from '@aws-ee/base-ui/dist/helpers/api';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { User } from './User';

const UserStore = BaseStore.named('UserStore')
  .props({
    user: types.maybe(User),
  })
  .actions(self => {
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

  .views(self => ({
    get empty() {
      return _.isEmpty(self.user);
    },

    // TODO this method should really be moved to the User model and renamed to something like projectIdOptions
    get projectIdDropdown() {
      const result = _.map(self.user.projectId, id => ({ key: id, value: id, text: id }));
      return result;
    },

    get cloneUser() {
      let result = {};
      const {
        username,
        authenticationProviderId,
        identityProviderName,
        firstName,
        lastName,
        email,
        isAdmin,
        status,
        userRole,
        rev,
        projectId,
      } = self.user;
      result = {
        username,
        authenticationProviderId,
        identityProviderName,
        firstName,
        lastName,
        email,
        isAdmin,
        status,
        rev,
        userRole,
        projectId,
      };
      return result;
    },
  }));

function registerContextItems(appContext) {
  appContext.userStore = UserStore.create({}, appContext);
}

export { UserStore, registerContextItems };
