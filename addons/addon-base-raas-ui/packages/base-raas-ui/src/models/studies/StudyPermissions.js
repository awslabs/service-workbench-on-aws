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

/* eslint-disable import/prefer-default-export */
import { types } from 'mobx-state-tree';

import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

// ==================================================================
// Study Permissions
// ==================================================================
const StudyPermissions = types
  .model('StudyPermissions', {
    id: types.identifier,
    adminUsers: types.array(UserIdentifier),
    readonlyUsers: types.array(UserIdentifier),
    createdAt: '',
    createdBy: UserIdentifier,
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
  })
  .views(_self => ({
    get userTypes() {
      return ['admin', 'readonly'];
    },
  }));

export { StudyPermissions };
