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

function getAccountForm(account) {
  const fields = {
    name: {
      label: 'Account Name',
      placeholder: 'Give a name to this account. This is for UI display purposes only',
      rules: 'required|max:300',
      value: account.name,
    },
    contactInfo: {
      label: 'Contact Information',
      placeholder:
        '(Optional) Type the contact information for the admins of this account. This information is purely for your convenience and it does not have any impact on the registration process.',
      rules: 'max:2048',
      value: account.contactInfo,
    },
    description: {
      label: 'Description',
      placeholder: '(Optional) A description for the account',
      rules: 'max:2048',
      value: account.description,
    },
  };
  return createForm(fields);
}

export { getAccountForm }; // eslint-disable-line import/prefer-default-export
