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
  updateAwsAccount,
  getAllAccountsPermissionStatus,
} from '../../helpers/api';
import { AwsAccount } from './AwsAccount';
import { AwsAccountStore } from './AwsAccountStore';
import { BudgetStore } from './BudgetStore';
import Budget from './Budget';

const filterNames = {
  ALL: 'All',
  CURRENT: 'Up-to-Date',
  UPDATEME: 'Needs Update',
  NEW: 'Needs Onboarding',
  ERRORED: 'Errored',
  PENDING: 'Pending',
};

// A map, with the key being the filter name and the value being the function that will be used to filter the workspace
// cfnStackName is an empty string if the account hasn't been onboarded yet
const filters = {
  [filterNames.ALL]: () => true,
  [filterNames.CURRENT]: account => account.permissionStatus === 'CURRENT',
  [filterNames.UPDATEME]: account => account.permissionStatus === 'NEEDS_UPDATE',
  [filterNames.NEW]: account => account.permissionStatus === 'NEEDS_ONBOARD',
  [filterNames.ERRORED]: account => account.permissionStatus === 'ERRORED',
  [filterNames.PENDING]: account => account.permissionStatus === 'PENDING',
};

// ==================================================================
// AwsAccountsStore
// ==================================================================
const AwsAccountsStore = BaseStore.named('AwsAccountsStore')
  .props({
    awsAccounts: types.optional(types.map(AwsAccount), {}),
    awsAccountStores: types.optional(types.map(AwsAccountStore), {}),
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
            awsAccount = { ...awsAccount };
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
        return addedAwsAccount;
      },

      createAwsAccount: async awsAccount => {
        await createAwsAccount(awsAccount);
      },

      updateAwsAccount: async (awsAccountUUID, updatedAcctInfo) => {
        await updateAwsAccount(awsAccountUUID, updatedAcctInfo);
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

      forceCheckAccountPermissions: async () => {
        await getAllAccountsPermissionStatus();
      },

      hasPendingAccounts: () => {
        return !_.isEmpty(_.filter(self.awsAccounts, acct => acct.permissionStatus === 'PENDING'));
      },

      getAwsAccountStore(accountId) {
        let entry = self.awsAccountStores.get(accountId);
        if (!entry) {
          // Lazily create the store
          self.awsAccountStores.set(accountId, AwsAccountStore.create({ accountId }));
          entry = self.awsAccountStores.get(accountId);
        }

        return entry;
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
        res.permissionStatus = awsAccount.permissionStatus;
        res.encryptionKeyArn = awsAccount.encryptionKeyArn;
        res.onboardStatusRoleArn = awsAccount.onboardStatusRoleArn;
        res.cfnStackName = awsAccount.cfnStackName;
        res.cfnStackId = awsAccount.cfnStackId;
        res.updatedAt = awsAccount.updatedAt;
        res.appStreamStackName = awsAccount.appStreamStackName;
        res.appStreamFleetName = awsAccount.appStreamFleetName;
        res.appStreamSecurityGroupId = awsAccount.appStreamSecurityGroupId;
        res.isAppStreamConfigured =
          !_.isUndefined(awsAccount.appStreamStackName) &&
          !_.isUndefined(awsAccount.appStreamFleetName) &&
          !_.isUndefined(awsAccount.appStreamSecurityGroupId);
        res.rev = awsAccount.rev;
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
