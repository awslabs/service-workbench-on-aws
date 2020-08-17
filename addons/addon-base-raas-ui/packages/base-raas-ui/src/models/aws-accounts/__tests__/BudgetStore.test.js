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

import * as mobxStateTreeModule from 'mobx-state-tree';
import { createAwsAccountBudget, updateAwsAccountBudget } from '../../../helpers/api';
import { BudgetStore } from '../BudgetStore';

jest.mock('../../../helpers/api');

describe('BudgetStore', () => {
  const store = BudgetStore.create({ awsAccountUUID: 'some-uuid-value' });

  describe('createOrUpdateBudget', () => {
    let awsAccount = {};
    const awsAccountsStore = {
      getAwsAccount: () => awsAccount,
    };
    mobxStateTreeModule.getParent = jest.fn().mockReturnValue(awsAccountsStore);

    it('should add a new budget successfully', async () => {
      // BUILD
      const newBudget = {
        budgetLimit: '1000.0',
        startDate: 1598400000,
        endDate: 1608854400,
        thresholds: [50, 90, 100],
        notificationEmail: 'test@example.com',
      };
      awsAccount = {
        budget: {
          budgetLimit: '',
        },
      };

      // OPERATE
      await store.createOrUpdateBudget(newBudget);

      // CHECK
      expect(createAwsAccountBudget).toHaveBeenCalledWith({ id: 'some-uuid-value', budgetConfiguration: newBudget });
    });

    it('should update an existing budget successfully', async () => {
      // BUILD
      const newBudget = {
        budgetLimit: '1000.0',
        startDate: 1598400000,
        endDate: 1608854400,
        thresholds: [],
        notificationEmail: '',
      };
      awsAccount = {
        budget: {
          budgetLimit: '500.0',
        },
      };

      // OPERATE
      await store.createOrUpdateBudget(newBudget);

      // CHECK
      expect(updateAwsAccountBudget).toHaveBeenCalledWith({
        id: 'some-uuid-value',
        budgetConfiguration: {
          budgetLimit: '1000.0',
          startDate: 1598400000,
          endDate: 1608854400,
        },
      });
    });

    it('should throw validation error when input is invalid', async () => {
      // BUILD
      const newBudget = {
        budgetLimit: '1000.0',
        startDate: 1598400000,
        endDate: 1608854400,
        thresholds: [50],
        notificationEmail: '',
      };

      // OPERATE and CHECK
      await expect(store.createOrUpdateBudget(newBudget)).rejects.toThrow(
        'Thresholds depends on notification. Please input notification or remove thresholds',
      );
    });
  });
});
