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

import { types } from 'mobx-state-tree';

// ==================================================================
// Budget
// ==================================================================
const Budget = types
  .model('Budget', {
    budgetLimit: '',
    startDate: '',
    endDate: '',
    thresholds: types.array(types.number),
    notificationEmail: '',
  })
  .actions(self => ({
    setBudget(rawBudget) {
      self.budgetLimit = rawBudget.budgetLimit;
      self.startDate = rawBudget.startDate;
      self.endDate = rawBudget.endDate;
      self.thresholds = rawBudget.thresholds;
      self.notificationEmail = rawBudget.notificationEmail;
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
  }));

// eslint-disable-next-line import/prefer-default-export
export default Budget;
