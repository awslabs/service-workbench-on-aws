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

import { createForm } from '../../helpers/form';

const addUserApplicationFormFields = {
  email: {
    label: 'Username',
    placeholder: 'Type email address as username for the user',
  },
  firstName: {
    label: 'First Name',
    placeholder: 'Your first name',
    explain: 'Your current default first name is ',
    rules: 'required|string',
  },
  lastName: {
    label: 'Last Name',
    placeholder: 'Your last name',
    explain: 'Your current default last name is ',
    rules: 'required|string',
  },
  applyReason: {
    label: 'Describe Your Research',
    explain: 'Please tell us why you are requesting access to the Research Portal',
    placeholder: 'Why are you requesting access?',
    rules: 'required|string',
  },
};

function getAddUserApplicationFormFields() {
  return addUserApplicationFormFields;
}

function getAddUserApplicationForm() {
  return createForm(addUserApplicationFormFields);
}

export { getAddUserApplicationFormFields, getAddUserApplicationForm };
