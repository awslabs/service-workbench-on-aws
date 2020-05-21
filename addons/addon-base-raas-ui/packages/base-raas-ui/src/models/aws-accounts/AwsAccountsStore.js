import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getAwsAccounts, addAwsAccount, createAwsAccount } from '../../helpers/api';
import { AwsAccount } from './AwsAccount';

// ==================================================================
// AwsAccountsStore
// ==================================================================
const AwsAccountsStore = BaseStore.named('AwsAccountsStore')
  .props({
    awsAccounts: types.optional(types.map(AwsAccount), {}),
    tickPeriod: 10 * 1000, // 10 sec
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const awsAccounts = (await getAwsAccounts()) || [];
        // We try to preserve existing accounts data and merge the new data instead
        // We could have used self.accounts.replace(), but it will do clear() then merge()
        self.runInAction(() => {
          awsAccounts.forEach(awsAccount => {
            const awsAccountsModel = AwsAccount.create(awsAccount);
            const previous = self.awsAccounts.get(awsAccountsModel.id);
            if (!previous) {
              self.awsAccounts.set(awsAccountsModel.id, awsAccountsModel);
            } else {
              previous.setAwsAccounts(awsAccount);
            }
          });
        });
        return undefined;
      },

      cleanup: () => {
        superCleanup();
      },

      addAwsAccount: async awsAccount => {
        const addedAwsAccount = await addAwsAccount(awsAccount);
        self.runInAction(() => {
          const addedAwsAccountModel = AwsAccount.create(addedAwsAccount);
          self.awsAccounts.set(addedAwsAccountModel.id, addedAwsAccountModel);
        });
      },

      createAwsAccount: async awsAccount => {
        await createAwsAccount(awsAccount);
      },
    };
  })

  .views(self => ({
    get list() {
      const result = [];
      // converting map self.users to result array
      self.awsAccounts.forEach(awsAccount => {
        const res = {};
        res.name = awsAccount.name;
        res.accountId = awsAccount.accountId;
        res.roleArn = awsAccount.roleArn;
        res.description = awsAccount.description;
        res.externalId = awsAccount.externalId;
        res.vpcId = awsAccount.vpcId;
        res.subnetId = awsAccount.subnetId;
        res.encryptionKeyArn = awsAccount.encryptionKeyArn;
        result.push(res);
      });
      return result;
    },

    get dropdownOptions() {
      const result = [];
      // converting map self.users to result array
      self.awsAccounts.forEach(awsAccount => {
        const account = {};
        account.key = awsAccount.id;
        account.value = awsAccount.id;
        // For migration purposes fallback to id if there's no name
        account.text = `${awsAccount.description} (${awsAccount.name || awsAccount.id})`;
        result.push(account);
      });
      return result;
    },

    getNameForAccountId(id) {
      const account = self.awsAccounts.get(id);

      // For migration purposes fallback to id if there's no name
      if (!account || !account.name) {
        return id;
      }

      return `${account.name} (${account.accountId})`;
    },
  }));

function registerContextItems(appContext) {
  appContext.awsAccountsStore = AwsAccountsStore.create({}, appContext);
}

export { AwsAccountsStore, registerContextItems };
