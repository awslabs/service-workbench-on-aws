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
import { getStaleUsers } from '../StudyPermissionsTable';

describe('StudyPermissionsTable tests', () => {
  describe('getStaleUsers', () => {
    it('Test stale users when no users are stale', async () => {
      const usersStore = {};
      usersStore.asUserObjects = jest.fn().mockImplementationOnce(() => {
        return [{ id: 1 }, { id: 2 }];
      });
      const staleUsers = getStaleUsers([1, 2], usersStore);
      expect(staleUsers).toEqual([]);
      expect(usersStore.asUserObjects).toHaveBeenCalledTimes(1);
    });

    it('Test stale users when all users are stale', async () => {
      const usersStore = {};
      usersStore.asUserObjects = jest.fn().mockImplementationOnce(() => {
        return [];
      });
      const staleUsers = getStaleUsers([1, 2], usersStore);
      expect(staleUsers).toEqual([1, 2]);
      expect(usersStore.asUserObjects).toHaveBeenCalledTimes(1);
    });

    it('Test stale users when one user is stale', async () => {
      const usersStore = {};
      usersStore.asUserObjects = jest.fn().mockImplementationOnce(() => {
        return [{ id: 1 }, { id: 4 }, { id: 3 }];
      });
      const staleUsers = getStaleUsers([1, 2, 4, 3], usersStore);
      expect(staleUsers).toEqual([2]);
      expect(usersStore.asUserObjects).toHaveBeenCalledTimes(1);
    });
  });
});
