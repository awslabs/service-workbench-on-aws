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

import { getParent, types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getDataSourceStudies } from '../../helpers/api';
import { DataSourceStudyStore } from './DataSourceStudyStore';
import { DataSourceStackInfoStore } from './DataSourceStackInfoStore';

// ==================================================================
// DataSourceAccountStore
// ==================================================================
const DataSourceAccountStore = BaseStore.named('DataSourceAccountStore')
  .props({
    accountId: '',
    studyStores: types.map(DataSourceStudyStore),
    stackInfoStore: types.maybe(DataSourceStackInfoStore),
    tickPeriod: 60 * 1000, // 1 minute
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const studies = await getDataSourceStudies(self.accountId);
        const account = self.account;
        account.setStudies(studies);
      },

      getStudyStore(studyId) {
        let entry = self.studyStores.get(studyId);
        if (!entry) {
          // Lazily create the store
          self.studyStores.set(studyId, DataSourceStudyStore.create({ accountId: self.accountId, studyId }));
          entry = self.studyStores.get(studyId);
        }

        return entry;
      },

      getStackInfoStore() {
        let entry = self.stackInfoStore;
        if (!entry) {
          // Lazily create the store
          self.stackInfoStore = DataSourceStackInfoStore.create({ accountId: self.accountId });
          entry = self.stackInfoStore;
        }

        return entry;
      },

      cleanup: () => {
        self.accountId = '';
        self.studyStores.clear();
        self.stackInfoStore.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get account() {
      const parent = getParent(self, 2);
      const a = parent.getAccount(self.accountId);
      return a;
    },

    get studiesTotal() {
      const account = self.account || { studies: {} };
      return account.studies.size;
    },

    getStudy(studyId) {
      return self.account.getStudy(studyId);
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use dataSourceAccountsStore.getDataSourceAccountStore()
// eslint-disable-next-line import/prefer-default-export
export { DataSourceAccountStore };
