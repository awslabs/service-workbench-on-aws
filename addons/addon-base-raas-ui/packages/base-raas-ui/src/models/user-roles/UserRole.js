import { types, applySnapshot } from 'mobx-state-tree';

import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

// ==================================================================
// UserRole
// ==================================================================
const UserRole = types
  .model('UserRole', {
    id: types.identifier,
    rev: types.maybe(types.number),
    description: '',
    userType: '',
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
  })
  .actions(self => ({
    setUserRole(rawUserRole) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, rawUserRole);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
  }));

// eslint-disable-next-line import/prefer-default-export
export { UserRole };
