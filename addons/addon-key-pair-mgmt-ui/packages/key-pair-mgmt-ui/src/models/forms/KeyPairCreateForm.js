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
import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

function getKeyPairCreateForm() {
  const fields = {
    name: {
      label: 'Name',
      placeholder: 'Name for this key',
      extra: {
        explain:
          'Easily identifiable name for this key. The name is used for display purposes.' +
          'It must be an alpha numeric string between 2 and 100 characters long may contain space, underscore (_) and/or dash (-).',
      },
      value: '',
      rules: ['required', 'min:2', 'max:100', 'regex:/^[A-Za-z0-9-_ ]+$/'],
    },
    desc: {
      label: 'Description',
      placeholder: 'Describe the purpose of this key, up to 1024 characters long.',
      value: '',
      rules: 'max:1024|string',
    },
  };

  return createForm(fields);
}

// eslint-disable-next-line import/prefer-default-export
export { getKeyPairCreateForm };
