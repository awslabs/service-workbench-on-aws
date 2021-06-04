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

import { types } from 'mobx-state-tree';
import Budget from './Budget';

// ==================================================================
// AwsAccounts
// ==================================================================
const AwsAccount = types
  .model('AwsAccounts', {
    id: types.identifier,
    rev: types.maybe(types.number),
    name: '',
    description: '',
    accountId: '',
    externalId: '',
    roleArn: '',
    vpcId: '',
    subnetId: '',
    encryptionKeyArn: '',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    needsPermissionUpdate: types.maybe(types.boolean),
    budget: types.optional(Budget, {}),
  })
  .actions(self => ({
    setAwsAccounts(rawAwsAccounts) {
      self.id = rawAwsAccounts.id;
      self.rev = rawAwsAccounts.rev || self.rev || 0;
      self.name = rawAwsAccounts.name || self.name || '';
      self.description = rawAwsAccounts.description || self.description;
      self.accountId = rawAwsAccounts.accountId || rawAwsAccounts.accountId;
      self.externalId = rawAwsAccounts.externalId || self.externalId;
      self.roleArn = rawAwsAccounts.roleArn || self.roleArn;
      self.vpcId = rawAwsAccounts.vpcId || self.vpcId;
      self.subnetId = rawAwsAccounts.subnetId || self.subnetId;
      self.encryptionKeyArn = rawAwsAccounts.encryptionKeyArn || self.encryptionKeyArn;
      self.createdAt = rawAwsAccounts.createdAt || self.createdAt;
      self.updatedAt = rawAwsAccounts.updatedAt || self.updatedAt;
      self.createdBy = rawAwsAccounts.createdBy || self.createdBy;
      self.updatedBy = rawAwsAccounts.updatedBy || self.updatedBy;
      self.needsPermissionUpdate =
        typeof rawAwsAccounts.needsPermissionUpdate === 'boolean'
          ? rawAwsAccounts.needsPermissionUpdate
          : self.needsPermissionUpdate;

      // Can't use || for needsPermissionUpdate because the value is a Boolean
      // we don't update the other fields because they are being populated by a separate store
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
  }));

// eslint-disable-next-line import/prefer-default-export
export { AwsAccount };
