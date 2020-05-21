import _ from 'lodash';
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { getAccounts, removeAccountInfo } from '../../helpers/api';
import { Account } from './Account';
import { AccountStore } from './AccountStore';

// ==================================================================
// AccountsStore
// ==================================================================
const AccountsStore = BaseStore.named('AccountsStore')
  .props({
    accounts: types.optional(types.map(Account), {}),
    accountStores: types.optional(types.map(AccountStore), {}),
    tickPeriod: 5 * 1000, // 10 sec
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const accounts = await getAccounts();
        // We try to preserve existing accounts data and merge the new data instead
        // We could have used self.accounts.replace(), but it will do clear() then merge()
        self.runInAction(() => {
          consolidateToMap(self.accounts, accounts, (exiting, newItem) => {
            exiting.setAccount(newItem);
          });
        });
        return undefined;
      },

      addAccount(rawAccount) {
        const id = rawAccount.id;
        const previous = self.accounts.get(id);

        if (!previous) {
          self.accounts.put(rawAccount);
        } else {
          previous.setAccount(rawAccount);
        }
      },

      async removeItem(id) {
        const account = self.accounts.get(id);
        self.accounts.delete(account);
        await removeAccountInfo(id);
      },

      getAccountStore: accountId => {
        let entry = self.accountStores.get(accountId);
        if (!entry) {
          // Lazily create the store
          self.accountStores.set(accountId, AccountStore.create({ accountId }));
          entry = self.accountStores.get(accountId);
        }

        return entry;
      },

      cleanup: () => {
        self.accounts.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get listCreatingAccount() {
      const result = [];
      self.accounts.forEach(account => {
        if (account.status === 'PENDING') {
          result.push(account);
        }
      });
      return _.reverse(_.sortBy(result, ['createdAt', 'name']));
    },

    get listErrorAccount() {
      const result = [];
      self.accounts.forEach(account => {
        if (account.status === 'FAILED') {
          result.push(account);
        }
      });
      return _.reverse(_.sortBy(result, ['createdAt', 'name']));
    },

    get empty() {
      return self.accounts.size === 0;
    },

    get total() {
      return self.accounts.size;
    },

    get list() {
      const result = [];
      self.accounts.forEach(account => result.push(account));

      return _.reverse(_.sortBy(result, ['createdAt', 'name']));
    },

    hasAccount(id) {
      return self.accounts.has(id);
    },

    getAccount(id) {
      return self.accounts.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.accountsStore = AccountsStore.create({}, appContext);
}

export { AccountsStore, registerContextItems };
