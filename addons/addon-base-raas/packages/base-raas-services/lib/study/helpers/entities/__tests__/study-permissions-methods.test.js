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

const { applyUpdateRequest } = require('../study-permissions-methods');

describe('study permissions methods', () => {
  describe('applyUpdateRequest', () => {
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
            uid: 'u-2',
            permissionLevel: 'readwrite',
          },
          {
            uid: 'u-3',
            permissionLevel: 'writeonly',
          },
        ],
      };
      const entity = {
        adminUsers: ['u-2'],
        readonlyUsers: ['u-3'],
        readwriteUsers: ['u-2'],
        writeonlyUsers: ['u-4', 'u-3'],
      };

      applyUpdateRequest(entity, updateRequest);
      expect(entity).toStrictEqual({
        adminUsers: ['u-2', 'u-1'],
        readonlyUsers: ['u-3', 'u-1'],
        readwriteUsers: [],
        writeonlyUsers: ['u-4'],
      });
    });
  });
});
