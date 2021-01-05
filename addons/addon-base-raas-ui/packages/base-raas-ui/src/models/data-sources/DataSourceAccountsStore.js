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
import React from 'react';
import { Header } from 'semantic-ui-react';
import { values } from 'mobx';
import { types } from 'mobx-state-tree';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import {
  getDataSourceAccounts,
  checkStudyReachability,
  checkAccountReachability,
  registerAccount,
  registerBucket,
  registerStudy,
  updateRegisteredAccount,
} from '../../helpers/api';
import { DataSourceAccount } from './DataSourceAccount';
import { DataSourceAccountStore } from './DataSourceAccountStore';

// ==================================================================
// DataSourceAccountsStore
// ==================================================================
const DataSourceAccountsStore = BaseStore.named('DataSourceAccountsStore')
  .props({
    accounts: types.map(DataSourceAccount),
    accountStores: types.map(DataSourceAccountStore),
    tickPeriod: 3 * 60 * 1000, // 3 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const accounts = await getDataSourceAccounts();
        self.runInAction(() => {
          consolidateToMap(self.accounts, accounts, (existing, newItem) => {
            existing.setDataSourceAccount(newItem);
          });
        });
      },

      addAccount(raw) {
        const id = raw.id;
        const previous = self.accounts.get(id);

        if (!previous) {
          self.accounts.set(raw.id, raw);
        } else {
          previous.setDataSourceAccount(raw);
        }
      },

      getAccountStore(accountId) {
        let entry = self.accountStores.get(accountId);
        if (!entry) {
          // Lazily create the store
          self.accountStores.set(accountId, DataSourceAccountStore.create({ accountId }));
          entry = self.accountStores.get(accountId);
        }

        return entry;
      },

      async updateAccount(account) {
        const updatedAccount = await updateRegisteredAccount(account.id, _.omit(account, ['id']));
        const existingAccount = self.getAccount(account.id);

        // If we get null values for the props, we need to change them to empty string
        if (_.isEmpty(updatedAccount.contactInfo)) {
          updatedAccount.contactInfo = '';
        }

        if (_.isEmpty(updatedAccount.description)) {
          updatedAccount.description = '';
        }

        if (_.isEmpty(updatedAccount.name)) {
          updatedAccount.name = '';
        }

        existingAccount.setDataSourceAccount(updatedAccount);
      },

      async registerAccount(account) {
        const newAccount = await registerAccount(account);
        self.addAccount(newAccount);

        return self.getAccount(account.id);
      },

      async registerBucket(accountId, bucket = {}) {
        const normalizedBucket = { ...bucket, awsPartition: 'aws', access: 'roles' };
        const account = self.getAccount(accountId);
        if (_.isEmpty(account)) throw new Error(`Account #${accountId} is not loaded yet`);

        const newBucket = await registerBucket(accountId, normalizedBucket);

        return account.setBucket(newBucket);
      },

      async registerStudy(accountId, bucketName, study = {}) {
        const account = self.getAccount(accountId);
        if (_.isEmpty(account)) throw new Error(`Account #${accountId} is not loaded yet`);

        const newStudy = await registerStudy(accountId, bucketName, study);

        return account.setStudy(newStudy);
      },

      async checkAccountReachability(accountId) {
        const accountEntity = await checkAccountReachability(accountId);
        const account = self.getAccount(accountId);
        if (account) account.setDataSourceAccount(accountEntity);
      },

      async checkStudyReachability(studyId) {
        const studyEntity = await checkStudyReachability(studyId);
        const account = self.getAccount(studyEntity.accountId);
        const study = account.getStudy(studyId);
        if (study) study.setStudy(studyEntity);
      },

      cleanup: () => {
        self.accounts.clear();
        self.accountStores.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.accounts.size === 0;
    },

    get total() {
      return self.accounts.size;
    },

    get list() {
      return _.orderBy(values(self.accounts), ['createdAt', 'name'], ['desc', 'asc']);
    },

    getAccount(id) {
      return self.accounts.get(id);
    },

    get dropdownOptions() {
      const result = _.map(values(self.accounts), account => ({
        key: account.id,
        value: account.id,
        text: account.id,
        content: (
          <Header
            as="h5"
            content={account.id}
            subheader={`${account.name}${account.hosting ? ' (Hosting Account)' : ''}`}
          />
        ),
      }));

      return result;
    },
  }));

function registerContextItems(appContext) {
  appContext.dataSourceAccountsStore = DataSourceAccountsStore.create({}, appContext);
}

export { DataSourceAccountsStore, registerContextItems };
