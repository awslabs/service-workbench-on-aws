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
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getAccountOnboardCfnTemplate } from '../../helpers/api';

// ==================================================================
// AwsAccountStore
// ==================================================================
const AwsAccountStore = BaseStore.named('AwsAccountStore')
  .props({
    accountId: '',
    tickPeriod: 2 * 60 * 1000, // 2 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const account = self.account;
        const stackInfo = await getAccountOnboardCfnTemplate(self.accountId);
        account.setStackInfo(stackInfo);
      },

      getOnboardTemplate: async awsAccountUUID => {
        const template = await getAccountOnboardCfnTemplate(awsAccountUUID);
        return template;
      },

      cleanup: () => {
        self.accountId = '';
        superCleanup();
      },
    };
  })

  .views(self => ({
    get account() {
      const parent = getParent(self, 2);
      const a = parent.getAwsAccount(self.accountId);
      return a;
    },

    get stackInfo() {
      const account = self.account;
      return account.stackInfo;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use AwsAccountsStore.getAwsAccountStore()
// eslint-disable-next-line import/prefer-default-export
export { AwsAccountStore };
