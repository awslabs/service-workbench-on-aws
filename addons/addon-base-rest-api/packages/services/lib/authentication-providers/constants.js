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

// TODO - move this to base-services in base addon
const constants = {
  authenticationProviders: {
    cognitoAuthProviderTypeId: 'cognito_user_pool',
    status: {
      initializing: 'initializing',
      active: 'active',
      inactive: 'inactive',
    },
    provisioningAction: {
      create: 'create',
      update: 'update',
      activate: 'activate',
      deactivate: 'deactivate',
    },
  },
};

module.exports = constants;
