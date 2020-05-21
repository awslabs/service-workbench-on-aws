import _ from 'lodash';
import { types } from 'mobx-state-tree';

const App = types
  .model('BaseApp', {
    userAuthenticated: false,
  })
  .actions(() => ({
    // I had issues using runInAction from mobx
    // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
    runInAction(fn) {
      return fn();
    },
  }))
  .actions(self => ({
    init: async payload => {
      const tokenNotExpired = _.get(payload, 'tokenInfo.status') === 'notExpired';
      if (tokenNotExpired) {
        self.setUserAuthenticated(true);
      }
    },

    setUserAuthenticated(flag) {
      self.userAuthenticated = flag;
    },

    // this method is called by the Cleaner
    cleanup() {
      self.setUserAuthenticated(false);
    },
  }));

function registerContextItems(appContext) {
  appContext.app = App.create({}, appContext);
}

export { App, registerContextItems };
