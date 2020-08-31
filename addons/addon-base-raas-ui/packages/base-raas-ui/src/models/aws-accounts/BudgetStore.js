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
import _ from 'lodash';

import { createAwsAccountBudget, getAwsAccountBudget, updateAwsAccountBudget } from '../../helpers/api';

// ==================================================================
// BudgetStore
// ==================================================================
const BudgetStore = BaseStore.named('BudgetStore')
  .props({
    awsAccountUUID: '',
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const rawBudget = await getAwsAccountBudget(self.awsAccountUUID);
        parent.addBudget(self.awsAccountUUID, rawBudget);
      },

      async createOrUpdateBudget(rawBudget) {
        const parent = getParent(self, 2);
        const existingBudget = parent.getAwsAccount(self.awsAccountUUID).budget;
        // Validate dependency between email and thresholds
        if (_.isEmpty(rawBudget.thresholds) && !_.isEmpty(rawBudget.notificationEmail)) {
          throw new Error('Notification depends on thresholds. Please input thresholds or remove notification.');
        }
        if (!_.isEmpty(rawBudget.thresholds) && _.isEmpty(rawBudget.notificationEmail)) {
          throw new Error('Thresholds depends on notification. Please input notification or remove thresholds');
        }
        // Remove empty attributes
        rawBudget = _.omitBy(rawBudget, val => _.isEmpty(val) && !_.isNumber(val));
        const requestData = {
          id: self.awsAccountUUID,
          budgetConfiguration: rawBudget,
        };
        if (_.isEmpty(existingBudget.budgetLimit)) {
          await createAwsAccountBudget(requestData);
        } else {
          await updateAwsAccountBudget(requestData);
        }
      },

      cleanup: () => {
        const parent = getParent(self, 2);
        superCleanup();
        parent.addBudget(self.awsAccountUUID, {});
      },
    };
  })

  .views(self => ({
    get budget() {
      const parent = getParent(self, 2);
      const account = parent.getAwsAccount(self.awsAccountUUID);
      return account.budget;
    },

    get thresholdsOptions() {
      return [
        { id: '50', value: 50, text: '50%' },
        { id: '70', value: 70, text: '70%' },
        { id: '80', value: 80, text: '80%' },
        { id: '90', value: 90, text: '90%' },
        { id: '100', value: 100, text: '100%' },
      ];
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use awsAccountsStore.getBudgetStore()
// eslint-disable-next-line import/prefer-default-export
export { BudgetStore };
