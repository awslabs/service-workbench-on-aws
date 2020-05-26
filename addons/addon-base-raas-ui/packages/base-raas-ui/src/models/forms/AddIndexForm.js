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

const addIndexFormFields = {
  id: {
    label: 'Index ID',
    placeholder: 'Type id for this index',
    rules: 'required|string|between:1,300',
  },
  awsAccountId: {
    label: 'AWS Account ID',
  },
  description: {
    label: 'Description',
    placeholder: 'Type description for this index',
    rules: 'string|between:1,3000',
  },
};

function getAddIndexFormFields() {
  return addIndexFormFields;
}

function getAddIndexForm() {
  return createForm(addIndexFormFields);
}

export { getAddIndexFormFields, getAddIndexForm };
