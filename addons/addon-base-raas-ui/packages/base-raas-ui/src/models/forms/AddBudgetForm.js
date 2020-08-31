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
import { createForm } from '../../helpers/form';

function getBudgetForm(existingBudget) {
  const addBudgetFormFields = {
    budgetLimit: {
      label: 'Budget Limit Dollar Amount',
      placeholder: 'Type the dollar amount for the budget',
      rules: 'required|numeric|regex:/^[^-]*$/', // regex to make sure the number is non-negative
      value: _.get(existingBudget, 'budgetLimit', ''),
    },
    // AWS Budget return date string with timezone information
    // trim it so it can be correctly shown by input type date
    startDate: {
      label: 'Budget Start Date',
      rules: 'required|string',
      value: _.get(existingBudget, 'startDate', '').slice(0, 10),
    },
    endDate: {
      label: 'Budget Expiration Date',
      extra: { explain: 'Budget expiration date need to be less than a year from start date.' },
      rules: 'required|string',
      value: _.get(existingBudget, 'endDate', '').slice(0, 10),
    },
    thresholds: {
      label: 'Thresholds',
      extra: {
        explain: 'Give percentage thresholds you would like to receive alarm for this budget, up to 5 thresholds.',
      },
      value: _.get(existingBudget, 'thresholds'),
    },
    notificationEmail: {
      label: 'Notification Email',
      extra: { explain: 'Email to notify when actual spent exceeds a threshold. ' },
      rules: 'email',
      value: _.get(existingBudget, 'notificationEmail'),
    },
  };
  return createForm(addBudgetFormFields);
}

export default getBudgetForm;
