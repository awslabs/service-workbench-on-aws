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
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import {
  getAwsAccounts,
  addAwsAccount,
  createAwsAccount,
  // updateAwsAccount,
  checkAccountPermissions,
} from '../../helpers/api';
import { AwsAccount } from './AwsAccount';
import { BudgetStore } from './BudgetStore';
import Budget from './Budget';

const filterNames = {
  ALL: 'All',
  CURRENT: 'Up-to-Date',
  UPDATEME: 'Needs Update',
  NEW: 'New',
};

// A map, with the key being the filter name and the value being the function that will be used to filter the workspace
const filters = {
  [filterNames.ALL]: () => true,
  [filterNames.CURRENT]: account => account.needsPermissionUpdate === false,
  [filterNames.UPDATEME]: account => account.needsPermissionUpdate === true,
  [filterNames.NEW]: account => account.needsPermissionUpdate === undefined,
};

// ==================================================================
// AwsAccountsStore
// ==================================================================
const AwsAccountsStore = BaseStore.named('AwsAccountsStore')
  .props({
    awsAccounts: types.optional(types.map(AwsAccount), {}),
    budgetStores: types.optional(types.map(BudgetStore), {}),
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

      checkPermissions: async () => {
        // This is a placeholder function that just switches the needsPermissionUpdate to its opposite value
        // Will be implemented later
        const awsAccounts = (await getAwsAccounts()) || [];
        const perms = [];
        self.runInAction(() => {
          awsAccounts.forEach(account => {
            const res = checkAccountPermissions(account.id, account);
            perms.push(res);
          });
        });
        return perms;
      },

      getBudgetStore: awsAccountUUID => {
        let entry = self.budgetStores.get(awsAccountUUID);
        if (!entry) {
          // Lazily create the store
          self.budgetStores.set(awsAccountUUID, BudgetStore.create({ awsAccountUUID }));
          entry = self.budgetStores.get(awsAccountUUID);
        }
        return entry;
      },

      addBudget: (awsAccountUUID, rawBudget) => {
        const account = self.awsAccounts.get(awsAccountUUID);
        account.budget = Budget.create(rawBudget);
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
        res.id = awsAccount.id;
        res.accountId = awsAccount.accountId;
        res.roleArn = awsAccount.roleArn;
        res.description = awsAccount.description;
        res.externalId = awsAccount.externalId;
        res.vpcId = awsAccount.vpcId;
        res.subnetId = awsAccount.subnetId;
        res.needsPermissionUpdate = awsAccount.needsPermissionUpdate;
        res.encryptionKeyArn = awsAccount.encryptionKeyArn;
        res.updatedAt = awsAccount.updatedAt;
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

    getAwsAccount(id) {
      return self.awsAccounts.get(id);
    },

    filtered(filterName) {
      const filter = filters[filterName] || (() => true);
      const result = [];
      self.list.forEach(awsAccount => {
        if (filter(awsAccount)) result.push(awsAccount);
      });
      return _.orderBy(result, [account => account.name.toLowerCase()], ['asc']);
    },
  }));

function registerContextItems(appContext) {
  appContext.awsAccountsStore = AwsAccountsStore.create({}, appContext);
}

export { AwsAccountsStore, filterNames, registerContextItems };
