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

const createAwsAccountFormFields = {
  accountName: {
    label: 'Account Name',
    placeholder: 'Type the name of this account',
    rules: 'required|string|between:1,100',
  },
  accountEmail: {
    label: 'AWS Account Email',
    placeholder: 'Type AWS account email',
    rules: 'required|string|email',
  },
  masterRoleArn: {
    label: 'Master Role Arn',
    placeholder: 'Type configured Role ARN of master account of the Organization',
    rules: 'required|string|between:10,300',
  },
  externalId: {
    label: 'External ID',
    placeholder: 'Type external ID for this AWS account',
    rules: 'required|string|between:1,300',
  },
  description: {
    label: 'Description',
    placeholder: 'Type description for this AWS account',
    rules: 'required|string',
  },
};

function getCreateAwsAccountFormFields() {
  return createAwsAccountFormFields;
}

function getCreateAwsAccountForm() {
  return createForm(createAwsAccountFormFields);
}

export { getCreateAwsAccountFormFields, getCreateAwsAccountForm };
