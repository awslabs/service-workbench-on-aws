import _ from 'lodash';
import { types } from 'mobx-state-tree';

import { getUser } from '../../helpers/api';
import { BaseStore } from '../BaseStore';
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
  }));

function registerContextItems(appContext) {
  appContext.userStore = UserStore.create({}, appContext);
}

export { UserStore, registerContextItems };
