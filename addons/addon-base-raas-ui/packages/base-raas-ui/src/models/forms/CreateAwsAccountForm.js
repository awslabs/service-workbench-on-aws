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

const createBaseAwsAccountFormFields = {
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

const createAwsAccountAppStreamFormFields = {
  appStreamFleetDesiredInstances: {
    label: 'AppStream Fleet Desired Instance',
    placeholder:
      'Maximum number of concurrently running AppStream sessions. Each researcher uses one AppStream session when viewing a workspace',
    rules: 'required|integer',
  },
  appStreamDisconnectTimeoutSeconds: {
    label: 'AppStreamDisconnectTimeoutSeconds',
    placeholder: 'The amount of time that a streaming session remains active after users disconnect.  (Minimum of 60)',
    rules: ['required', 'integer', 'min:60'],
  },
  appStreamIdleDisconnectTimeoutSeconds: {
    label: 'AppStreamIdleDisconnectTimeoutSeconds',
    placeholder:
      'The amount of time that users can be idle (inactive) before they are disconnected from their streaming session',
    rules: 'required|integer',
  },
  appStreamMaxUserDurationSeconds: {
    label: 'AppStreamMaxUserDurationSeconds',
    placeholder: 'The maximum amount of time that a streaming session can remain active, in seconds',
    rules: 'required|integer',
  },
  appStreamImageName: {
    label: 'AppStreamImageName',
    placeholder: 'The name of the image used to create the fleet',
    rules: 'required|string',
  },
  appStreamInstanceType: {
    label: 'AppStreamInstanceType',
    placeholder:
      'The instance type to use when launching fleet instances. List of images available at https://aws.amazon.com/appstream2/pricing/',
    rules: 'required|string',
  },
  appStreamFleetType: {
    label: 'AppStreamFleetType',
    placeholder: 'The fleet type. Should be either ALWAYS_ON or ON_DEMAND',
    rules: ['required', 'regex:/^ALWAYS_ON|ON_DEMAND$/'],
  },
};

function getCreateBaseAwsAccountFormFields() {
  return createBaseAwsAccountFormFields;
}

function getCreateAwsAccountAppStreamFormFields() {
  return createAwsAccountAppStreamFormFields;
}

function getCreateAwsAccountForm(fields) {
  return createForm(fields);
}

export { getCreateBaseAwsAccountFormFields, getCreateAwsAccountForm, getCreateAwsAccountAppStreamFormFields };
