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

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

// Mocked dependencies

// we need the custom DbService Mock
jest.mock('../../db-service');
const DbServiceMock = require('../../db-service');

jest.mock('../../db-password/db-password-service');
const DbPasswordServiceMock = require('../../db-password/db-password-service');

jest.mock('../../authorization/authorization-service');
const AuthServiceMock = require('../../authorization/authorization-service');

jest.mock('../user-authz-service');
const UserAuthzServiceMock = require('../user-authz-service');

jest.mock('../../audit/audit-writer-service');
const AuditServiceMock = require('../../audit/audit-writer-service');

jest.mock('../../settings/env-settings-service');
const SettingsServiceMock = require('../../settings/env-settings-service');

const UserService = require('../user-service');
const JsonSchemaValidationService = require('../../json-schema-validation-service');

describe('UserService', () => {
  let service = null;
  let dbService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    // container.register('log', new Logger());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('dbPasswordService', new DbPasswordServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('userAuthzService', new UserAuthzServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('userService', new UserService());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('userService');
    dbService = await container.find('dbService');

    // Skip authorization
    service.assertAuthorized = jest.fn();
  });

  describe('createUser', () => {
    it('should fail because the user lacks a username', async () => {
      // BUILD
      const newUser = {
        email: 'example@example.com',
        firstName: 'Jaime',
        lastName: 'Lannister',
      };

      // OPERATE
      try {
        await service.createUser({}, newUser);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail because password cannot be provided with federated users', async () => {
      // BUILD
      const newUser = {
        username: 'tlannister',
        email: 'dragonsrkool@example.com',
        firstName: 'Tirion',
        lastName: 'Lannister',
        password: 'LongLiveTheQu33n',
        authenticationProviderId: 'external',
      };

      // OPERATE
      try {
        await service.createUser({}, newUser);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Cannot specify password when adding federated users');
      }
    });

    it('should fail because user already exists', async () => {
      // BUILD
      const newUser = {
        username: 'jsnow',
        email: 'nightwatch@example.com',
        firstName: 'Jon',
        lastName: 'Snow',
      };
      service.getUserByPrincipal = jest.fn().mockResolvedValue(newUser);

      // OPERATE
      try {
        await service.createUser({}, newUser);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Cannot add user. The user already exists.');
      }
    });

    it('should not save user password to the DB', async () => {
      // BUILD
      const newUser = {
        username: 'hpie',
        email: 'sourcherries@example.com',
        firstName: 'Hot',
        lastName: 'Pie',
        password: 'i-hope-youre-not-storing-me!',
      };
      service.getUserByPrincipal = jest.fn();
      service.audit = jest.fn();

      const toCheck = { password: newUser.password };
      // OPERATE
      await service.createUser({}, newUser);

      // CHECK
      expect(dbService.table.item).not.toHaveBeenCalledWith(expect.objectContaining(toCheck));
      expect(service.audit).not.toHaveBeenCalledWith({}, expect.objectContaining(toCheck));
    });

    it('should try to create a user', async () => {
      // BUILD
      const newUser = {
        username: 'nstark',
        email: 'headlesshorseman@example.com',
        firstName: 'Ned',
        lastName: 'Stark',
      };
      service.getUserByPrincipal = jest.fn();
      service.audit = jest.fn();

      // OPERATE
      await service.createUser({}, newUser);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: expect.any(String),
        }),
      );
      expect(service.audit).toHaveBeenCalledWith({}, expect.objectContaining({ action: 'create-user' }));
    });
  });

  describe('updateUser', () => {
    const uid = 'u-testUpdateUserId';
    const newUser = {
      uid,
      username: 'dtargaryen',
      email: 'dragonseverywhere@example.com',
      firstName: 'Daenerys',
      lastName: 'Targaryen',
    };
    it('should fail because no value of rev was provided', async () => {
      // BUILD
      const toUpdate = {
        username: 'dtargaryen',
      };

      service.findUser = jest.fn().mockResolvedValue(newUser);

      // OPERATE
      try {
        await service.updateUser({}, toUpdate);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail because the user does not exist', async () => {
      // BUILD
      const toUpdate = {
        uid,
        rev: 2,
      };

      service.findUser = jest.fn().mockResolvedValue();

      // OPERATE
      try {
        await service.updateUser({}, toUpdate);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(`Cannot update user "${uid}". The user does not exist`);
      }
    });

    it('should fail because the user was just updated', async () => {
      // BUILD
      const toUpdate = {
        uid,
        rev: 2,
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      service.findUser = jest.fn().mockResolvedValue(newUser);

      // OPERATE
      try {
        await service.updateUser({}, toUpdate);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'outdatedUpdateAttempt')).toBe(true);
      }
    });

    it('should successfully try to update the user', async () => {
      // BUILD
      const toUpdate = {
        uid,
        usernameInIdp: 'user1',
        rev: 2,
      };

      service.findUser = jest.fn().mockResolvedValue(newUser);
      service.audit = jest.fn();

      // OPERATE
      await service.updateUser({}, toUpdate);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith(expect.objectContaining({ uid }));
      expect(service.audit).toHaveBeenCalledWith({}, expect.objectContaining({ action: 'update-user' }));
    });
  });

  describe('deleteUser', () => {
    const uid = 'u-testDeleteUserId';
    const curUser = {
      uid,
      username: 'astark',
      email: 'ilovemasks@example.com',
      firstName: 'Arya',
      lastName: 'Stark',
      authenticationProviderId: 'house_stark',
      identityProviderId: 'ned',
    };

    it('should fail because the user does not exist', async () => {
      // BUILD
      service.findUser = jest.fn().mockResolvedValue();

      // OPERATE
      try {
        await service.deleteUser({}, { username: 'lskywalker' });
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'notFound')).toBe(true);
      }
    });

    it('should fail because the user does not exist in the db', async () => {
      // BUILD
      service.findUser = jest.fn().mockResolvedValue(curUser);
      dbService.table.delete.mockImplementationOnce(() => {
        throw error;
      });

      // OPERATE
      try {
        await service.deleteUser({}, curUser);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(`The user "${uid}" does not exist`);
      }
    });

    it('should successfully try to delete the user', async () => {
      // BUILD
      service.findUser = jest.fn().mockResolvedValue(curUser);
      service.audit = jest.fn();

      // OPERATE
      await service.deleteUser({}, curUser);
      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith(expect.objectContaining({ uid }));
      expect(service.audit).toHaveBeenCalledWith({}, expect.objectContaining({ action: 'delete-user' }));
    });
  });
});
