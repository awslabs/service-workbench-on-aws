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
