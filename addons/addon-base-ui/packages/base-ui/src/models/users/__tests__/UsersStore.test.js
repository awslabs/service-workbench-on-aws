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

import { registerContextItems as registerUsersStore } from '../UsersStore';
import { addUser, getUsers, updateUser } from '../../../helpers/api';

jest.mock('../../../helpers/api');

describe('UsersStore', () => {
  let store = null;
  const appContext = {};
  const newUser = {
    firstName: 'gordon',
    lastName: 'freeman',
    username: 'gf_lambda',
    ns: 'gf_lambda.xen',
    email: 'gfreeman@example.com',
    userType: 'Researcher',
    isAdmin: true,
    authenticationProviderId: 'black_mesa', // Id of the authentication provider this user is authenticated against (such as internal, cognito auth provider id etc)
    identityProviderName: 'lambda_sector', // Name of the identity provider this user belongs to (such as Identity Provider Id in cognito user pool in case of Federation etc)
    status: 'active',
    projectId: ['grav-gun'],
    rev: 0,
  };

  const updatedUser = {
    firstName: 'G-man',
    lastName: 'unknown',
    username: 'gf_lambda',
    ns: 'gf_lambda.xen',
    email: 'redacted@example.com',
    userType: 'Administrator',
    isAdmin: true,
  };

  beforeEach(async () => {
    await registerUsersStore(appContext);
    store = appContext.usersStore;
  });

  describe('addUser', () => {
    it('should add a new user', async () => {
      // BUILD
      getUsers.mockResolvedValueOnce([]);
      addUser.mockResolvedValueOnce(newUser);
      await store.load();

      // OPERATE
      await store.addUser(newUser);

      // CHECK
      expect(newUser).toMatchObject(store.list[0]);
    });

    it('should not add user because it already exists', async () => {
      // BUILD
      getUsers.mockResolvedValueOnce([newUser]);
      addUser.mockResolvedValueOnce(newUser);
      await store.load();

      // OPERATE
      await store.addUser(newUser);

      // CHECK
      expect(store.list.length).toBe(1);
    });
  });

  describe('updateUser', () => {
    it('should update the user info', async () => {
      // BUILD
      getUsers.mockResolvedValueOnce([newUser]);
      updateUser.mockResolvedValueOnce(updatedUser);
      await store.load();

      // OPERATE
      await store.updateUser(updatedUser);

      // CHECK
      expect(store.list[0]).toMatchObject(updatedUser);
    });
  });
});
