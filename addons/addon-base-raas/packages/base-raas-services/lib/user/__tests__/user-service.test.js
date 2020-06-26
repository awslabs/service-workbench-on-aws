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

    // Skip authorization
    service.assertAuthorized = jest.fn();
  });

  describe('create a user', () => {
    it('should fail due because the user already exists', async () => {
      const user = {
        isAdmin: true,
        email: 'example@amazon.com',
        authenticationProviderId: 'internal',
        userRole: 'dev',
      };

      service.toUserType = jest.fn(() => {
        return { userType: 'root' };
      });
      service.findUser = jest.fn(() => {
        return user;
      });
      service.log = console;
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
});
