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

import { createFormSeparatedFormat } from '../../helpers/form';

function getRegisterStudyForm() {
  const fields = [
    'account.id',
    'account.name',
    'account.description',
    'account.contactInfo',
    'studies',
    'studies[].id',
    'studies[].name',
    'studies[].folder',
  ];

  const labels = {
    'account.id': 'AWS Account ID',
    'account.name': 'Account Name',
    'account.contactInfo': 'Contact Information',
    'studies': 'Studies',
    'studies[].id': 'Study Id',
    'studies[].name': 'Study Name',
    'studies[].folder': 'Study Folder',
  };

  const placeholders = {
    'account.id': 'The AWS account id that owns the bucket that contains the studies',
    'account.name': 'Give a name to this account. This is for UI display purposes only',
    'account.contactInfo':
      '(Optional) Type the contact information for the admins of this account. This information is purely for your convenience and it does not have any impact on the registration process.',
  };

  const extra = {
    // 'account.id': {
    //   explain: 'The AWS account id that owns the bucket that contains the studies',
    // },
  };

  const rules = {
    'account.id': 'required|min:12|max:12|regex:/^[0-9]+$/',
    'account.name': 'max:300',
    'studies[].name': 'required',
  };

  return createFormSeparatedFormat({ fields, labels, placeholders, extra, rules });
}

// eslint-disable-next-line import/prefer-default-export
export { getRegisterStudyForm };
