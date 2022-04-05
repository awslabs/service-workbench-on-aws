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

import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@amzn/base-ui/dist/models/BaseStore';

import { getAccount } from '../../helpers/api';

// ==================================================================
// AccountStore
// ==================================================================
const AccountStore = BaseStore.named('AccountStore')
  .props({
    accountId: '',
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const rawAccount = await getAccount(self.accountId);
        parent.addAccount(rawAccount);
        return undefined;
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get account() {
      const parent = getParent(self, 2);
      const w = parent.getAccount(self.accountId);
      return w;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use accountsStore.getAccountStore()
// eslint-disable-next-line import/prefer-default-export
export { AccountStore };
