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

const addAwsAccountFormFields = {
  name: {
    label: 'Account Name',
    placeholder: 'Type the name of this account',
    rules: 'required|string|between:1,100',
  },
  accountId: {
    label: 'AWS Account ID',
    placeholder: 'Type the 12-digit AWS account ID',
    rules: 'required|string|size:12',
  },
  roleArn: {
    label: 'Role Arn',
    placeholder: 'Type Role ARN for launching resources into this AWS account',
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
  vpcId: {
    label: 'VPC ID',
    placeholder: 'Type the ID of the VPC where EMR clusters will be launched',
    rules: 'required|string|min:12|max:21',
  },
  subnetId: {
    label: 'Subnet ID',
    placeholder: 'Type the ID of the subnet where the EMR clusters will be launched',
    rules: 'required|string|min:15|max:24',
  },
  encryptionKeyArn: {
    label: 'KMS Encryption Key ARN',
    placeholder: 'Type the KMS Encryption Key ARN to use for this AWS account',
    rules: 'required|string|between:1,100',
  },
};

function getAddAwsAccountFormFields() {
  return addAwsAccountFormFields;
}

function getAddAwsAccountForm() {
  return createForm(addAwsAccountFormFields);
}

export { getAddAwsAccountFormFields, getAddAwsAccountForm };
