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

import _ from 'lodash';
import { StudyFilesStore } from './StudyFilesStore';
import { StudyPermissionsStore } from './StudyPermissionsStore';
import { categories } from './categories';

// 'pending', 'error', 'default'
const states = {
  pending: {
    key: 'pending',
    display: 'PENDING',
    color: 'orange',
    tip:
      'This study is in the process of being configured. Once the configuration is completed by the Service Workbench admins, the study status will become available.',
    canChangePermission: false,
    canSelect: false,
    spinner: true,
  },
  error: {
    key: 'error',
    display: 'UNAVAILABLE',
    color: 'red',
    tip: 'There seems to be an issue accessing the study files. Please contact Service Workbench admins.',
    canChangePermission: false,
    canSelect: false,
    spinner: false,
  },
  reachable: {
    key: 'default',
    display: 'AVAILABLE',
    color: 'green',
    tip: 'The study is available and ready for use.',
    canChangePermission: true,
    canSelect: true,
    spinner: false,
  },
};

// ==================================================================
// Study
// ==================================================================
const Study = types
  .model('Study', {
    id: types.identifier,
    rev: types.maybe(types.number),
    name: '',
    status: types.maybe(types.string),
    category: '',
    projectId: '',
    accessType: types.maybe(types.string),
    access: types.optional(types.array(types.string), []),
    resources: types.optional(types.array(types.model({ arn: types.string })), []),
    description: types.maybeNull(types.string),
    uploadLocationEnabled: false,
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    filesStore: types.maybe(StudyFilesStore),
    permissionsStore: types.maybe(StudyPermissionsStore),
  })
  .actions(self => ({
    setStudy(rawStudy) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, rawStudy);
    },

    getFilesStore() {
      if (!self.filesStore) {
        self.filesStore = StudyFilesStore.create({ studyId: self.id });
      }
      return self.filesStore;
    },

    getPermissionsStore() {
      if (!self.permissionsStore) {
        self.permissionsStore = StudyPermissionsStore.create({ studyId: self.id });
      }
      return self.permissionsStore;
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
    get isOpenDataStudy() {
      return self.category === categories.openData.name; // TODO the backend should really send an id and not a name
    },

    get isOrganizationStudy() {
      return self.category === categories.organization.name; // TODO the backend should really send an id and not a name
    },

    get state() {
      if (self.status) {
        return _.cloneDeep(states[self.status]);
      }
      return _.cloneDeep(states.reachable);
    },

    get userTypes() {
      if (self.accessType === 'readonly') {
        return ['admin', 'readonly'];
      }
      return ['admin', 'readwrite', 'readonly'];
    },

    get canUpload() {
      return self.access.includes('admin') || self.access.includes('readwrite');
    },
  }));

export { Study }; // eslint-disable-line import/prefer-default-export
