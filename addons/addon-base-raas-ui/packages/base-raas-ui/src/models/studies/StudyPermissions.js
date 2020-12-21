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

// ==================================================================
// Study Permissions
// ==================================================================
const StudyPermissions = types
  .model('StudyPermissions', {
    id: types.identifier,
    adminUsers: types.array(types.string),
    readonlyUsers: types.array(types.string),
    readwriteUsers: types.array(types.string),
    writeonlyUsers: types.array(types.string),
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
  })
  .actions(self => ({
    setStudyPermissions(raw = {}) {
      self.adminUsers.replace(raw.adminUsers || []);
      self.readonlyUsers.replace(raw.readonlyUsers || []);
      self.readwriteUsers.replace(raw.readwriteUsers || []);
      self.writeonlyUsers.replace(raw.writeonlyUsers || []);
      self.createdAt = raw.createdAt;
      self.createdBy = raw.createdBy;
      self.updatedAt = raw.updatedAt;
      self.updatedBy = raw.updatedBy;
    },
  }))
  .views(self => ({
    isStudyAdmin(uid) {
      return self.adminUsers.some(adminUid => adminUid === uid);
    },
  }));

export { StudyPermissions };
