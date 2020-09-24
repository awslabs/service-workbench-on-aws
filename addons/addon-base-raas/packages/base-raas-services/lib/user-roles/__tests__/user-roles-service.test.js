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
  let dbService = null;
  beforeAll(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('userRolesService', new UserRolesService());
    await container.initServices();

    service = await container.find('userRolesService');
    dbService = await container.find('dbService');

    // skip authorization
    service.assertAuthorized = jest.fn();
  });

  // create() currently assumes 'updatedBy' is always a user (see line 74 / 114)
  // if/when that is changed, we will need another unit test
  describe('create test', () => {
    it('should fail if no id is provided', async () => {
      const roleToCreate = {
        description: 'this is gonna be great!',
        userType: 'EXTERNAL',
      };

      try {
        await service.create({}, roleToCreate);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should successfully try to create a user role', async () => {
      // BUILD
      const roleToCreate = {
        id: 'Murasaki Shikibu',
        description: 'Hikaru Genji no inochi monogatari desu',
        userType: 'INTERNAL',
      };

      service.audit = jest.fn();

      // OPERATE
      await service.create({}, roleToCreate);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'create-user-role', body: undefined });
    });

    it('should fail because the id already exists', async () => {
      const roleToCreate = {
        id: 'testFAIL',
        userType: 'INTERNAL',
      };

      // Mock dynamodb throwing an error because item.id already exists
      const error = { code: 'ConditionalCheckFailedException' };
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      try {
        await service.create({}, roleToCreate);
        expect.hasAssertions();
      } catch (err) {
        expect(dbService.table.condition).toHaveBeenCalledWith('attribute_not_exists(id)');
        expect(dbService.table.key).toHaveBeenCalledWith({ id: 'testFAIL' });
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
        rev: 1,
        userType: 'INTERNAL',
      };

      service.audit = jest.fn();

      // OPERATE
      await service.update(context, datum);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(context, { action: 'update-user-role', body: undefined });
    });

    it('should fail because the id does not exist', async () => {
      // BUILD
      const datum = {
        id: 'testFAIL',
        rev: 1,
        userType: 'EXTERNAL',
      };
      service.find = jest.fn().mockResolvedValue(undefined);

      // Mock dynamodb throwing an error because item.id does not exist
      const error = { code: 'ConditionalCheckFailedException' };
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

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
        rev: 1,
        userType: 'INTERNAL',
      };

      // Mock dynamodb throwing an error because revision has already been updated
      const error = { code: 'ConditionalCheckFailedException' };
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      service.find = jest.fn().mockResolvedValue({ updatedBy: { username: 'tsukuyomi' } });

      // OPERATE
      try {
        await service.update({}, datum);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(dbService.table.rev).toHaveBeenCalledWith(1);
        expect(err.message).toEqual(
          'userRoles information changed just before your request is processed, please try again',
        );
      }
    });

    it('should fail because no value for rev was provided', async () => {
      // BUILD
      const ipt = {
        id: 'testFAIL',
        userType: 'INTERNAL',
      };

      // OPERATE
      try {
        await service.update({}, ipt);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('Input has validation errors');
      }
    });
  });

  describe('delete tests', () => {
    it('should fail because the id does not exist', async () => {
      // BUILD
      const datum = {
        id: 'testFAIL',
      };

      // Mock dynamodb throwing an error because item.id does not exist
      const error = { code: 'ConditionalCheckFailedException' };
      dbService.table.delete.mockImplementationOnce(() => {
        throw error;
      });

      // OPERATE
      try {
        await service.delete({}, datum);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(dbService.table.key).toHaveBeenCalledWith({ id: 'testFAIL' });
        expect(dbService.table.delete).toHaveBeenCalled();
        expect(err.message).toEqual('userRoles with id "testFAIL" does not exist');
      }
    });
  });
});
