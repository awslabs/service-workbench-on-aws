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

jest.mock('../../user-roles/user-roles-service');
const UserRolesServiceMock = require('../../user-roles/user-roles-service');

const UserService = require('../user-service');

describe('UserService', () => {
  let service = null;
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
    container.register('userService', new UserService());

    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('userService');
  });

  describe('create a non-existing user', () => {
    it('should call createUser', async () => {
      const user = {
        email: 'example@amazon.com',
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();

      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.findUser = jest.fn(() => {
        return null;
      });
      service.createUser = jest.fn();

      await service.createUsers({}, [user], 'internal');
      expect(service.createUser).toHaveBeenCalled();
    });
  });

  describe('create an existing user', () => {
    it('should fail due because the user already exists', async () => {
      const user = {
        email: 'example@amazon.com',
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();

      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.findUser = jest.fn(() => {
        return user;
      });

      // test
      try {
        await service.createUsers({}, [user], 'internal');
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload[0];
        expect(error).toEqual('Error creating user example@amazon.com. Cannot add user. The user already exists.');
      }
    });
  });

  describe('create a user with same email but different name', () => {
    it('should fail because a duplicate user exists', async () => {
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
      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.findUser = jest.fn(() => {
        return user1;
      });
      service.createUser = jest.fn();

      try {
        await service.createUsers({}, [user2], 'internal');
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload[0];
        expect(error).toEqual('Error creating user example@amazon.com. Cannot add user. The user already exists.');
      }
    });
  });

  describe('try to create a user without permissions', () => {
    it('should fail because of insufficient permissions', async () => {
      const user = {
        email: 'example@amazon.com',
      };

      // Fail authorization
      service.assertAuthorized = jest.fn(() => {
        return false;
      });

      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.findUser = jest.fn(() => {
        return null;
      });

      // test
      try {
        await service.createUsers({}, [user], 'internal');
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload[0];
        expect(error).toEqual('Error creating user example@amazon.com');
      }
    });
  });

  describe('try to create multiple users', () => {
    it('should call createUser 4 times', async () => {
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

      // Skip authorization
      service.assertAuthorized = jest.fn();

      // mocked functions
      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.findUser = jest.fn(() => {
        return null;
      });
      service.createUser = jest.fn();

      await service.createUsers({}, [user1, user2, user3, user4], 'internal');
      expect(service.createUser).toHaveBeenCalledTimes(4);
    });
  });
});
