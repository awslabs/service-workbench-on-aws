import { types, applySnapshot } from 'mobx-state-tree';

import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

import { StudyFilesStore } from './StudyFilesStore';
import { StudyPermissionsStore } from './StudyPermissionsStore';
import { categories } from './categories';

// ==================================================================
// Study
// ==================================================================
const Study = types
  .model('Study', {
    id: types.identifier,
    rev: types.maybe(types.number),
    name: '',
    category: '',
    projectId: '',
    access: types.maybe(types.string),
    resources: types.optional(types.array(types.model({ arn: types.string })), []),
    description: types.maybeNull(types.string),
    uploadLocationEnabled: false,
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
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
  }));

export { Study }; // eslint-disable-line import/prefer-default-export
