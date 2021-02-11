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
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/db-password/db-password-service');
const DbPasswordServiceMock = require('@aws-ee/base-services/lib/db-password/db-password-service');

jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/user/user-authz-service');
const UserAuthzServiceMock = require('@aws-ee/base-services/lib/user/user-authz-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../../user-roles/user-roles-service');
const UserRolesServiceMock = require('../../user-roles/user-roles-service');

const UserService = require('../user-service');

describe('UserService', () => {
  let service;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('log', new Logger());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('dbPasswordService', new DbPasswordServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('userAuthzService', new UserAuthzServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('userRolesService', new UserRolesServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('userService', new UserService());

    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('userService');

    // Skip authorization
    service.assertAuthorized = jest.fn();
  });

  describe('updateUser', () => {
    it('should not fail validation when usernameInIdp in schema', async () => {
      const user = {
        email: 'example@amazon.com',
        usernameInIdp: 'example',
        uid: 'user1',
        rev: 0,
      };

      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.getUserByPrincipal = jest.fn(() => {
        return null;
      });
      service.findUser = jest.fn(() => {
        return user;
      });
      await service.updateUser({}, user);
    });

    it('should fail validation when unknown property in schema', async () => {
      const user = {
        email: 'example@amazon.com',
        usernameInIdp: 'example',
        uid: 'user1',
        rev: 0,
        unknown: 'unknownProperty',
      };

      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.getUserByPrincipal = jest.fn(() => {
        return null;
      });
      service.findUser = jest.fn(() => {
        return user;
      });
      try {
        await service.updateUser({}, user);
        expect.fail('Expected to throw error validation errors');
      } catch (err) {
        expect(err.message).toEqual('Input has validation errors');
      }
    });
  });

  describe('createUsers', () => {
    it('should try to create a user', async () => {
      const user = {
        email: 'example@amazon.com',
      };

      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.getUserByPrincipal = jest.fn(() => {
        return null;
      });
      service.createUser = jest.fn();

      await service.createUsers({}, [user], 'internal');
      expect(service.createUser).toHaveBeenCalled();
    });

    it('should fail due because the user already exists', async () => {
      // BUILD
      const user = {
        email: 'example@amazon.com',
      };

      service.toUserType = jest.fn().mockResolvedValue({ userType: 'root' });
      service.getUserByPrincipal = jest.fn().mockResolvedValue(user);

      // OPERATE
      try {
        await service.createUsers({}, [user], 'internal');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.payload).toBeDefined();
        const error = err.payload[0];
        expect(error).toEqual('Error creating user example@amazon.com. Cannot add user. The user already exists.');
      }
    });

    it('should fail because a duplicate user exists', async () => {
      // BUILD
      const user1 = {
        email: 'example@amazon.com',
        firstName: 'Bill',
        lastName: 'Nye',
      };

      const user2 = {
        email: 'example@amazon.com',
        firstName: 'theScience',
        lastName: 'Guy',
      };

      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.getUserByPrincipal = jest.fn(() => {
        return user1;
      });
      service.createUser = jest.fn();

      // OPERATE
      try {
        await service.createUsers({}, [user2], 'internal');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.payload).toBeDefined();
        const error = err.payload[0];
        expect(error).toEqual('Error creating user example@amazon.com. Cannot add user. The user already exists.');
      }
    });

    it('should fail because of insufficient permissions', async () => {
      // BUILD
      const user = {
        email: 'example@amazon.com',
      };

      // Fail authorization
      service.assertAuthorized = jest.fn(() => {
        throw service.boom.forbidden('You are not authorized to perform this operation', true);
      });

      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.getUserByPrincipal = jest.fn(() => {
        return null;
      });

      // OPERATE
      try {
        await service.createUsers({}, [user], 'internal');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.status).toEqual(403);
        expect(err.code).toEqual('forbidden');
        expect(err.message).toEqual('You are not authorized to perform this operation');
      }
    });

    it('should call createUser 4 times', async () => {
      // BUILD
      const user1 = {
        email: 'athos@dumas.com',
        isAdmin: true,
      };
      const user2 = {
        email: 'porthos@dumas.com',
        isAdmin: true,
      };
      const user3 = {
        email: 'aramis@dumas.com',
        isAdmin: true,
      };
      const user4 = {
        email: 'dArtagnan@alexandre.com',
        isAdmin: false,
      };

      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.getUserByPrincipal = jest.fn(() => {
        return null;
      });
      service.createUser = jest.fn();

      // OPERATE
      await service.createUsers({}, [user1, user2, user3, user4], 'internal');

      // CHECK
      expect(service.createUser).toHaveBeenCalledTimes(4);
    });
  });
});
