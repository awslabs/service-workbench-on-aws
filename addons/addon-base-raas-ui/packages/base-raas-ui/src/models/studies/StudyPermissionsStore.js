/* eslint-disable import/prefer-default-export */
import _ from 'lodash';
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getStudyPermissions, updateStudyPermissions } from '../../helpers/api';
import { StudyPermissions } from './StudyPermissions';

// ==================================================================
// StudyStore
// ==================================================================
const StudyPermissionsStore = BaseStore.named('StudyPermissionsStore')
  .props({
    studyId: types.identifier,
    studyPermissions: types.maybe(StudyPermissions),
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      doLoad: async () => {
        const newPermissions = await getStudyPermissions(self.studyId);
        if (!self.studyPermissions || !_.isEqual(self.studyPermissions, newPermissions)) {
          self.runInAction(() => {
            self.studyPermissions = newPermissions;
          });
        }
      },

      cleanup: () => {
        superCleanup();
      },

      update: async selectedUsers => {
        const updateRequest = { usersToAdd: [], usersToRemove: [] };

        self.studyPermissions.userTypes.forEach(type => {
          const userToRequestFormat = user => ({ principalIdentifier: user, permissionLevel: type });

          // Set selected users as "usersToAdd" (API is idempotent)
          updateRequest.usersToAdd.push(...selectedUsers[type].map(userToRequestFormat));

          // Set removed users as "usersToRemove"
          updateRequest.usersToRemove.push(
            ..._.differenceWith(self.studyPermissions[`${type}Users`], selectedUsers[type], _.isEqual).map(
              userToRequestFormat,
            ),
          );
        });

        // Perform update and reload store
        await updateStudyPermissions(self.studyId, updateRequest);
        await self.load();
      },
    };
  });

export { StudyPermissionsStore };
