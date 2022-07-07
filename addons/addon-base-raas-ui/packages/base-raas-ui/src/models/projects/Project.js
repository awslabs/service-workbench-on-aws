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
import { types, applySnapshot, getEnv } from 'mobx-state-tree';

// ==================================================================
// Project
// ==================================================================
const Project = types
  .model('Project', {
    id: types.identifier,
    rev: types.maybe(types.number),
    description: '',
    indexId: '',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    projectAdmins: types.optional(types.array(types.string), []),
    isAppStreamConfigured: types.optional(types.boolean, false),
  })
  .actions(self => ({
    setProject(rawProject) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, rawProject);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
    get projectAdminUsers() {
      const usersStore = getEnv(self).usersStore;
      return _.map(self.projectAdmins, uid => usersStore.asUserObject({ uid }));
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { Project };
