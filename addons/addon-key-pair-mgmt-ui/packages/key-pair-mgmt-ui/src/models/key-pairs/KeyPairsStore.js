import _ from 'lodash';
import { values } from 'mobx';
import { types } from 'mobx-state-tree';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { createKeyPair, getKeyPairs, deleteKeyPair } from '../../helpers/api';
import { KeyPair } from './KeyPair';

// ==================================================================
// KeyPairsStore
// ==================================================================
const KeyPairsStore = BaseStore.named('KeyPairsStore')
  .props({
    keyPairs: types.optional(types.map(KeyPair), {}),
    tickPeriod: 30 * 1000, // 30 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const keyPairs = await getKeyPairs();
        self.runInAction(() => {
          consolidateToMap(self.keyPairs, keyPairs, (exiting, newItem) => {
            exiting.setKeyPair(newItem);
          });
        });
      },

      addKeyPair(raw) {
        const id = raw.id;
        const previous = self.keyPairs.get(id);

        if (!previous) {
          self.keyPairs.put(raw);
        } else {
          previous.setKeyPair(raw);
        }
      },

      async createKetPair(keyPair) {
        // keyPair = { name, desc }

        const result = await createKeyPair(keyPair);
        self.addKeyPair(result);
        return self.getKeyPair(result.id);
      },

      async deleteKeyPair(id) {
        await deleteKeyPair(id);
        self.runInAction(() => {
          self.keyPairs.delete(id);
        });
      },

      cleanup: () => {
        self.keyPairs.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.keyPairs.size === 0;
    },

    get total() {
      return self.keyPairs.size;
    },

    get list() {
      return _.orderBy(values(self.keyPairs), ['createdAt', 'name'], ['desc', 'asc']);
    },

    get listActive() {
      return _.filter(self.list, item => item.status === 'active');
    },

    getKeyPair(id) {
      return self.keyPairs.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.keyPairsStore = KeyPairsStore.create({}, appContext);
}

export { KeyPairsStore, registerContextItems };
