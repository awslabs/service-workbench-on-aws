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
import { values } from 'mobx';
import { types } from 'mobx-state-tree';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getDataSourceAccounts, checkStudyReachability } from '../../helpers/api';
import { DataSourceAccount } from './DataSourceAccount';
import { DataSourceAccountStore } from './DataSourceAccountStore';

// ==================================================================
// DataSourceAccountsStore
// ==================================================================
const DataSourceAccountsStore = BaseStore.named('DataSourceAccountsStore')
  .props({
    accounts: types.map(DataSourceAccount),
    accountStores: types.map(DataSourceAccountStore),
    tickPeriod: 10 * 60 * 1000, // 10 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const accounts = await getDataSourceAccounts();
        self.runInAction(() => {
          consolidateToMap(self.accounts, accounts, (exiting, newItem) => {
            exiting.setDataSourceAccount(newItem);
          });
        });
      },

      addAccount(raw) {
        const id = raw.id;
        const previous = self.accounts.get(id);

        if (!previous) {
          self.accounts.put(raw);
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

      getStudyStore({ accountId, studyId }) {
        const accountStore = self.getAccountStore(accountId);
        return accountStore.getStudyStore(studyId);
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
  }));

function registerContextItems(appContext) {
  appContext.dataSourceAccountsStore = DataSourceAccountsStore.create({}, appContext);
}

export { DataSourceAccountsStore, registerContextItems };
