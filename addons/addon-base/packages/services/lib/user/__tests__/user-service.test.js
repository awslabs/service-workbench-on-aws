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
        authenticationProviderId: 'someIdpId',
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
        username: 'dragonsrkool@example.com',
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
        username: 'nightwatch@example.com',
        email: 'nightwatch@example.com',
        firstName: 'Jon',
        lastName: 'Snow',
        authenticationProviderId: 'someIdpId',
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

    it('should try to create a user', async () => {
      // BUILD
      const newUser = {
        username: 'headlesshorseman@example.com',
        email: 'headlesshorseman@example.com',
        firstName: 'Ned',
        lastName: 'Stark',
        authenticationProviderId: 'someIdpId',
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

    const validEmails = [
      'email@domain.com',
      'firstname.lastname@domain.com',
      'email@subdomain.domain.com',
      'firstname+lastname@domain.com',
      '1234567890@domain.com',
      'email@domain-one.com', // Dash in domain name is valid
      '_______@domain.com', // Underscore in the address field is valid
      'email@domain.name',
      'email@domain.co.jp',
      'firstname-lastname@domain.com',
      'firstname-lastname@domain.aridiculouslylongtldfortesting',
    ];
    it.each(validEmails)('should pass when creating users with valid email: %p', async email => {
      // BUILD
      const newUser = {
        username: email,
        email,
        firstName: 'Ned',
        lastName: 'Stark',
        authenticationProviderId: 'someIdpId',
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

    const invalidEmails = [
      'plainaddress',
      '#@%^%#$@#$@#.com', // Garbage
      '@domain.com', // Missing username
      'Joe Smith <email@domain.com>', // Encoded html within email
      'email.domain.com', // Missing @
      'email@domain@domain.com', // Two @ sign
      '.email@domain.com', // Leading dot in address
      'email.@domain.com', // Trailing dot in address
      'あいうえお@domain.com', // Unicode char as address
      'email@domain.com (Joe Smith)', // Text followed email is not allowed
      'email@domain', // Missing top level domain (.com/.net/.org/etc)
      'email@-domain.com', // Leading dash in front of domain is invalid
      'email@domain..com', // Multiple dot in the domain portion is invalid
      'firstname-lastname@domain.12345678901234567890123456789012345678901234567890123456789012345678901234567890abittoolongtld',
    ];
    it.each(invalidEmails)('should fail when creating users with invalid email: %p', async email => {
      // BUILD
      const newUser = {
        username: email,
        email,
        firstName: 'Ned',
        lastName: 'Stark',
        authenticationProviderId: 'someIdpId',
      };
      service.getUserByPrincipal = jest.fn();
      service.audit = jest.fn();

      // OPERATE
      try {
        await service.createUser({}, newUser);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail when creating internal auth users', async () => {
      // BUILD
      const email = 'test@example.com';
      const newUser = {
        username: email,
        email,
        firstName: 'Ned',
        lastName: 'Stark',
        authenticationProviderId: 'internal',
      };
      service.getUserByPrincipal = jest.fn();
      service.audit = jest.fn();

      // OPERATE
      try {
        await service.createUser({}, newUser);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(
          'Internal users cannot be created. Please use an external IdP or the native Cognito user pool',
        );
      }
    });
  });

  describe('updateUser', () => {
    const uid = 'u-testUpdateUserId';
    const newUser = {
      uid,
      username: 'dragonseverywhere@example.com',
      email: 'dragonseverywhere@example.com',
      firstName: 'Daenerys',
      lastName: 'Targaryen',
      ns: 'IdPNamespace',
    };
    it('should fail because no value of rev was provided', async () => {
      // BUILD
      const toUpdate = {
        username: 'dragonseverywhere@example.com',
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

    it('should fail because internal user cannot be activated', async () => {
      // BUILD
      const toUpdate = {
        uid,
        status: 'active',
        rev: 2,
      };

      const existingUser = {
        uid,
        username: 'dragonseverywhere@example.com',
        email: 'dragonseverywhere@example.com',
        firstName: 'Daenerys',
        lastName: 'Targaryen',
        ns: 'internal',
      };

      service.findUser = jest.fn().mockResolvedValue(existingUser);

      // OPERATE
      try {
        await service.updateUser({}, toUpdate);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Internal users cannot be activated');
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
      username: 'ilovemasks@example.com',
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
        await service.deleteUser({}, { username: 'ilovemasks@example.com' });
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

  describe('listUsers', () => {
    it('should list users', async () => {
      // BUILD
      dbService.table.scan.mockResolvedValueOnce([
        {
          isAdmin: true,
        },
      ]);
      const mockRequestContext = { principal: { isAdmin: true } };
      // OPERATE
      const result = await service.listUsers(mockRequestContext, {});

      // CHECK
      expect(dbService.table.scan).toHaveBeenCalled();
      expect(result).toEqual([
        {
          isAdmin: true,
        },
      ]);
    });
  });

  describe('isInternalAuthUser', () => {
    it('should return true when user is internal', async () => {
      // BUILD
      const uid = 'sample-user';
      service.mustFindUser = jest.fn().mockImplementationOnce(() => {
        return { authenticationProviderId: 'internal' };
      });

      // OPERATE
      const result = await service.isInternalAuthUser(uid);

      // CHECK
      expect(result).toBeTruthy();
    });

    it('should return false when user is not internal', async () => {
      // BUILD
      const uid = 'sample-user';
      service.mustFindUser = jest.fn().mockImplementationOnce(() => {
        return { authenticationProviderId: 'some-auth-id' };
      });

      // OPERATE
      const result = await service.isInternalAuthUser(uid);

      // CHECK
      expect(result).toBeFalsy();
    });
  });
});
