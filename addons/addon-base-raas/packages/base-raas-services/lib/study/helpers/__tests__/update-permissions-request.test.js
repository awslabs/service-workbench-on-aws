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

const _ = require('lodash');

const { getImpactedUsers, applyToUserPermissions } = require('../update-permissions-request');

describe('update permissions request helper', () => {
  describe('getImpactedUsers', () => {
    it('returns uniq user ids of all users in the update request', () => {
      const updateRequest = {
        usersToAdd: [
          {
            uid: 'u-1',
            permissionLevel: 'writeonly',
          },
          {
            uid: 'u-1',
            permissionLevel: 'readonly',
          },
        ],
        usersToRemove: [
          {
            uid: 'u-2',
            permissionLevel: 'writeonly',
          },
          {
            uid: 'u-3',
            permissionLevel: 'readonly',
          },
        ],
      };
      expect(getImpactedUsers(updateRequest)).toStrictEqual(['u-1', 'u-2', 'u-3']);
    });

    it('returns empty array if update request is empty', () => {
      expect(getImpactedUsers()).toStrictEqual([]);
    });

    it('returns uniq user ids even only usersToAdd is present', () => {
      const updateRequest = {
        usersToAdd: [
          {
            uid: 'u-1',
            permissionLevel: 'writeonly',
          },
          {
            uid: 'u-1',
            permissionLevel: 'readonly',
          },
        ],
      };
      expect(getImpactedUsers(updateRequest)).toStrictEqual(['u-1']);
    });

    it('returns uniq user ids even only usersToRemove is present', () => {
      const updateRequest = {
        usersToRemove: [
          {
            uid: 'u-1',
            permissionLevel: 'writeonly',
          },
          {
            uid: 'u-1',
            permissionLevel: 'readonly',
          },
        ],
      };
      expect(getImpactedUsers(updateRequest)).toStrictEqual(['u-1']);
    });

    it('returns an empty array if both usersToAdd and usersToRemove are empty', () => {
      const updateRequest = {
        usersToRemove: [],
        usersToAdd: [],
      };
      expect(getImpactedUsers(updateRequest)).toStrictEqual([]);
    });
  });

  describe('applyToUserPermissions', () => {
    it('no change to the userPermissions if no userAdds/Remove where related to the user', () => {
      const updateRequest = {
        usersToAdd: [
          {
            uid: 'u-1',
            permissionLevel: 'admin',
          },
          {
            uid: 'u-1',
            permissionLevel: 'readonly',
          },
        ],
        usersToRemove: [
          {
            uid: 'u-2',
            permissionLevel: 'writeonly',
          },
          {
            uid: 'u-3',
            permissionLevel: 'readonly',
          },
        ],
      };
      const entity = {
        uid: 'u-current',
        adminAccess: [],
      };

      const cloned = _.cloneDeep(entity);
      applyToUserPermissions(updateRequest, entity, 'study-1');
      expect(entity).toStrictEqual(cloned);
    });

    it('should apply requested changes', () => {
      const updateRequest = {
        usersToAdd: [
          {
            uid: 'u-1',
            permissionLevel: 'admin',
          },
          {
            uid: 'u-1',
            permissionLevel: 'readonly',
          },
        ],
        usersToRemove: [
          {
            uid: 'u-1',
            permissionLevel: 'readwrite',
          },
          {
            uid: 'u-1',
            permissionLevel: 'writeonly',
          },
        ],
      };
      const entity = {
        uid: 'u-1',
        adminAccess: [],
        readwriteAccess: ['study-1'],
        writeonlyAccess: ['study-1', 'study-1'],
      };

      applyToUserPermissions(updateRequest, entity, 'study-1');
      expect(entity).toStrictEqual({
        uid: 'u-1',
        adminAccess: ['study-1'],
        readonlyAccess: ['study-1'],
        readwriteAccess: [],
        writeonlyAccess: [],
      });
    });
  });
});
