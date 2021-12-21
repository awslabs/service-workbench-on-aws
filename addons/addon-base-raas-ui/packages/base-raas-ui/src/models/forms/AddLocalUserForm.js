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
/* eslint-disable import/prefer-default-export */
import { createForm } from '../../helpers/form';

const addUserFormFields = {
  email: {
    label: 'Username',
    placeholder: 'Type email address as username for the user',
    extra: { explain: 'Username in email format' },
    rules: 'required|email|string',
  },
  password: {
    label: 'Password',
    placeholder: 'Type default password for the user',
    explain: `The password must be between 4 and 2048 characters long.`,
    rules: 'required|string|between:4,2048',
  },
  firstName: {
    label: 'First Name',
    placeholder: 'Type first name of the user',
    rules: 'required|string|between:1,500',
  },
  lastName: {
    label: 'Last Name',
    placeholder: 'Type last name of the user',
    rules: 'required|string|between:1,500',
  },
  userRole: {
    label: 'UserRole',
    extra: { explain: "Select user's role" },
    rules: 'required',
  },
  projectId: {
    label: 'Projects',
    extra: { explain: 'Select projects that this user are associated with' },
  },
  status: {
    label: 'Status',
    extra: {
      explain: 'Active users can log into the Research Portal',
      yesLabel: 'Active',
      noLabel: 'Inactive',
      yesValue: 'active',
      noValue: 'inactive',
    },
    rules: 'required',
  },
};

function getAddUserForm() {
  return createForm(addUserFormFields);
}

export { getAddUserForm };
