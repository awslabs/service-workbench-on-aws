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
import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getStudyPermissions } from '../../helpers/api';

// ==================================================================
// DataSourceStudyStore
// ==================================================================
const DataSourceStudyStore = BaseStore.named('DataSourceStudyStore')
  .props({
    accountId: '',
    studyId: '',
    tickPeriod: 1 * 60 * 1000, // 1 minute
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const study = self.study;
        const permissions = await getStudyPermissions(self.studyId);
        if (_.isUndefined(study)) return;
        study.setPermissions(permissions);
      },

      cleanup: () => {
        self.accountId = '';
        self.studyId = '';
        superCleanup();
      },
    };
  })

  .views(self => ({
    get account() {
      const parent = getParent(self, 2);
      const a = parent.account;
      return a;
    },
    get study() {
      return self.account.getStudy(self.studyId);
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use dataSourceAccountsStore.getDataSourceStudyStore()
// eslint-disable-next-line import/prefer-default-export
export { DataSourceStudyStore };
