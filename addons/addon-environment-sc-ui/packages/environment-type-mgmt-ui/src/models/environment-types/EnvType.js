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
import { EnvTypeCandidate } from './EnvTypeCandidate';
import { getValidStatuses, isApproved, isNotApproved } from './EnvTypeStatusEnum';

// ====================================================================================================================================
// EnvType -- (is an EnvTypeCandidate that's already imported)
// ====================================================================================================================================
const EnvType = EnvTypeCandidate.named('EnvType')
  .props({
    rev: 0,
    status: types.enumeration('EnvTypeStatus', getValidStatuses()),
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
  })
  .actions(self => ({
    setEnvType(envType) {
      applySnapshot(self, envType);
    },
  }))
  .views(self => ({
    get isApproved() {
      return isApproved(self.status);
    },
    get isNotApproved() {
      return isNotApproved(self.status);
    },
  }));

export default EnvType;
export { EnvType };
