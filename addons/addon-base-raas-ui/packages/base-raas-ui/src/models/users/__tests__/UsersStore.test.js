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

import { addUser, updateUser, getUsers } from '@aws-ee/base-ui/dist/helpers/api';
import { addUsers } from '../../../helpers/api';

import { registerContextItems as registerUsersStore } from '../UsersStore';

jest.mock('@aws-ee/base-ui/dist/helpers/api');
jest.mock('../../../helpers/api');

describe('UsersStore', () => {
  let store = null;
  const appContext = {};
  const uid = 'u-exampleUserId';
  const exampleUser = {
    uid,
    firstName: 'ExampleFn',
    lastName: 'ExampleLn',
    username: 'example',
    ns: 'example.025',
  };

  beforeEach(async () => {
    await registerUsersStore(appContext);
    store = appContext.usersStore;
  });

  describe('adding users', () => {
    it('should add a user', async () => {
      // BUILD
      getUsers.mockResolvedValueOnce([]);
      addUser.mockResolvedValueOnce(exampleUser);

      // store = UsersStore.create({}, {});
      await store.load();

      // OPERATE
      await store.addUser(exampleUser);

      // CHECK
      // note we can't match the object because store.list[0] is just get/set methods
      expect(store.list[0].firstName).toEqual(exampleUser.firstName);
      expect(store.list[0].lastName).toEqual(exampleUser.lastName);
    });

    it('should add two users', async () => {
      // BUILD
      getUsers.mockResolvedValueOnce([]);
      const otherUser = {
        uid: 'u-exampleUserId2',
        firstName: 'ExampleFn2',
        lastName: 'ExampleLn2',
        username: 'example2',
        ns: 'example2.025',
      };

      addUser.mockResolvedValueOnce(exampleUser).mockResolvedValueOnce(otherUser);
      addUsers.mockImplementation(async () => {
        await store.addUser(exampleUser);
        await store.addUser(otherUser);
      });

      // store = UsersStore.create({}, {});
      await store.load();

      // OPERATE
      await store.addUsers([exampleUser, otherUser]);

      // CHECK
      expect(store.list[0].firstName).toEqual(exampleUser.firstName);
      expect(store.list[0].lastName).toEqual(exampleUser.lastName);
      expect(store.list[1].firstName).toEqual(otherUser.firstName);
      expect(store.list[1].lastName).toEqual(otherUser.lastName);
    });
  });

  describe('updating users', () => {
    it('should update the user', async () => {
      // BUILD
      const updatedExampleUser = {
        uid,
        firstName: 'ExampleFnUpdated',
        lastName: 'ExampleLnUpdated',
        username: 'example',
        ns: 'example.025',
      };
      getUsers.mockResolvedValueOnce([exampleUser]);
      updateUser.mockResolvedValueOnce(updatedExampleUser);

      // store = UsersStore.create({}, {});
      await store.load();

      // OPERATE
      await store.updateUser(exampleUser);

      // CHECK
      expect(store.list[0].firstName).toEqual(updatedExampleUser.firstName);
      expect(store.list[0].lastName).toEqual(updatedExampleUser.lastName);
    });
  });

  describe('deleting users', () => {
    it('should delete the user', async () => {
      // BUILD
      getUsers.mockResolvedValue([exampleUser]);
      await store.load();

      // OPERATE
      await store.deleteUser(exampleUser);

      // CHECK
      expect(store.list.length).toEqual(0);
    });
  });
});
