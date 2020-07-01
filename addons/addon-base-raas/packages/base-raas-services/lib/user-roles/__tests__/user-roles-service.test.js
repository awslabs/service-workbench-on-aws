const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

jest.mock('@aws-ee/base-services/lib/json-schema-validation-service');
const JsonSchemaValidationServiceMock = require('@aws-ee/base-services/lib/json-schema-validation-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

const UserRolesService = require('../user-roles-service');

// create, update, delete
describe('UserRolesService', () => {
  let service = null;
  beforeAll(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('userRolesService', new UserRolesService());
    await container.initServices();

    service = await container.find('userRolesService');

    // skip authorization
    service.assertAuthorized = jest.fn();
  });

  // create() currently assumes 'updatedBy' is always a user (see line 74 / 114)
  // if/when that is changed, we will need another unit test
  describe('create test', () => {
    it('should successfully log an audit event saying a user role was created', async () => {
      // BUILD
      const roleToCreate = {
        properties: {
          id: 'Murasaki Shikibu',
          description: 'Hikaru Genji no inochi monogatari desu',
          userType: 'internal',
        },
      };

      service.audit = jest.fn();

      // OPERATE
      await service.create({}, roleToCreate);

      // CHECK
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'create-user-role', body: undefined });
    });

    it('should fail because the id already exists', async () => {
      const roleToCreate = {
        id: 'testFAIL',
      };

      try {
        await service.create({}, roleToCreate);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('userRoles with id "testFAIL" already exists');
      }
    });
  });

  describe('update tests', () => {
    it('should succeed to update role', async () => {
      // BUILD
      const context = {
        principalIdentifier: {
          username: 'oohirume no muchi no kami',
          ns: 'izanagi to izanami',
        },
      };

      const datum = {
        id: 'yasakani no magatama',
        rev: 'yata no kagami',
      };

      service.audit = jest.fn();

      // OPERATE
      await service.update(context, datum);

      // CHECK
      expect(service.audit).toHaveBeenCalledWith(context, { action: 'update-user-role', body: undefined });
    });

    it('should fail because the id does not exist', async () => {
      // BUILD
      const datum = {
        id: 'testFAIL',
        rev: 'kusanagi no tsurugi',
      };
      service.find = jest.fn().mockResolvedValue(undefined);

      // OPERATE
      try {
        await service.update({}, datum);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('userRoles with id "testFAIL" does not exist');
      }
    });

    it('should fail because the user is already being updated', async () => {
      // BUILD
      const datum = {
        id: 'testFAIL',
      };
      service.find = jest.fn().mockResolvedValue({ updatedBy: { username: 'tsukuyomi' } });

      // OPERATE
      try {
        await service.update({}, datum);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(
          'userRoles information changed by "tsukuyomi" just before your request is processed, please try again',
        );
      }
    });
  });

  describe('delete tests', () => {
    it('should fail because the id does not exist', async () => {
      // BUILD
      const datum = {
        id: 'testFAIL',
      };

      // OPERATE
      try {
        await service.delete({}, datum);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('userRoles with id "testFAIL" does not exist');
      }
    });
  });
});
