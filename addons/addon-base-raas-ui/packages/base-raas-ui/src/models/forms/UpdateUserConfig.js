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
import { toValueFromIdp } from './UserFormUtils';

function getUpdateUserConfigFormFields(existingUser) {
  return {
    username: {
      label: 'Username',
      value: _.get(existingUser, 'username', ''),
    },
    firstName: {
      label: 'First Name',
      placeholder: 'First name of this user',
      value: _.get(existingUser, 'firstName', ''),
      rules: 'required|string',
    },
    lastName: {
      label: 'Last Name',
      placeholder: 'Last name of this user',
      value: _.get(existingUser, 'lastName', ''),
      rules: 'required|string',
    },
    email: {
      label: 'Email',
      placeholder: 'email address',
      value: _.get(existingUser, 'email', ''),
      rules: 'required|email|string',
    },
    identityProviderName: {
      label: 'Identity Provider Name',
      value: toValueFromIdp({
        authenticationProviderId: _.get(existingUser, 'authenticationProviderId', ''),
        identityProviderName: _.get(existingUser, 'identityProviderName', ''),
      }),
    },
    projectId: {
      label: 'Project',
      value: _.get(existingUser, 'projectId', ''),
    },
    userRole: {
      label: 'User Role',
      value: _.get(existingUser, 'userRole', ''),
    },
    applyReason: {
      label: 'Reason for Applying',
      explain: ' ',
      value: _.get(existingUser, 'applyReason', ''),
    },
    status: {
      label: 'User Status',
      extra: {
        explain: 'Active users can log into the Research Portal',
        yesLabel: 'Active',
        noLabel: 'Inactive',
        yesValue: 'active',
        noValue: 'inactive',
      },
      value: _.get(existingUser, 'status', ''),
    },
  };
}

function getUpdateUserConfigForm(existingUser) {
  return createForm(getUpdateUserConfigFormFields(existingUser));
}

export { getUpdateUserConfigFormFields, getUpdateUserConfigForm };
