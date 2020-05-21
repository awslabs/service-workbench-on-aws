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
