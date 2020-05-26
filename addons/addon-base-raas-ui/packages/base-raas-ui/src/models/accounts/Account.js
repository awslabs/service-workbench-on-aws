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

import { types, applySnapshot } from 'mobx-state-tree';

import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

const CfnInfo = types.model({
  crossAccountExecutionRoleArn: '',
  subnetId: '',
  vpcId: '',
  stackId: '',
});
// ==================================================================
// Account
// ==================================================================
const Account = types
  .model('Account', {
    id: types.identifier,
    accountName: '',
    status: '',
    accountArn: '',
    email: '',
    cfnInfo: types.optional(CfnInfo, {}),
    rev: types.maybe(types.number),
    name: '',
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
  })
  .actions((self) => ({
    setAccount(rawAccount) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, rawAccount);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views((self) => ({
    // add view methods here
  }));

// eslint-disable-next-line import/prefer-default-export
export { Account };
