import _ from 'lodash';
import { runInAction } from 'mobx';

import { forgetIdToken } from '../helpers/api';

// An object that captures all the clean up logic when the app is done or no jwt token
// is found.
class Cleaner {
  constructor(appContext) {
    this.appContext = appContext;
  }

  cleanup() {
    const { disposers, intervalIds } = this.appContext;

    // it is important that we start with cleaning the disposers, otherwise snapshots events will be fired
    // for cleaned stores
    let keys = _.keys(disposers);
    _.forEach(keys, key => {
      const fn = disposers[key];
      if (_.isFunction(fn)) {
        fn();
      }
      delete disposers[key];
    });

    keys = _.keys(intervalIds);
    _.forEach(keys, key => {
      const id = intervalIds[key];
      if (!_.isNil(id)) {
        clearInterval(id);
      }
      delete intervalIds[key];
    });

    runInAction(() => {
      forgetIdToken();

      _.forEach(this.appContext, obj => {
        if (obj === this) return; // we don't want to end up in an infinite loop
        if (_.isFunction(obj.cleanup)) {
          // console.log(`Cleaner.cleanup() : calling ${key}.clear()`);
          obj.cleanup();
        }
      });
    });
  }
}

function registerContextItems(appContext) {
  appContext.cleaner = new Cleaner(appContext);
}

export { Cleaner, registerContextItems };
