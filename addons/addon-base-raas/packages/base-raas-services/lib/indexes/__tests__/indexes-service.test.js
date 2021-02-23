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

jest.mock('../../aws-accounts/aws-accounts-service');
const AwsAccountsServiceMock = require('../../aws-accounts/aws-accounts-service');

const IndexesService = require('../indexes-service');

// Tested Functions: create, update, delete
describe('IndexesService', () => {
  let service = null;
  let dbService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('indexesService', new IndexesService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('indexesService');
    dbService = await container.find('dbService');

    // Skip authorization
    service.assertAuthorized = jest.fn();
  });

  describe('create', () => {
    it('should fail if awsAccountId is empty', async () => {
      // BUILD

      const index = {
        id: 'index-123',
        description: 'Some relevant description',
        awsAccountId: '', // empty awsAccountId should cause error
      };

      // OPERATE
      try {
        await service.create({}, index);
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const thrownError = err.payload.validationErrors[0];
        // CHECK
        expect(thrownError).toMatchObject({
          keyword: 'minLength',
          dataPath: '.awsAccountId',
          message: 'should NOT be shorter than 1 characters',
        });
      }
    });

    it('should fail if the id already exists', async () => {
      // BUILD

      const index = {
        id: 'id-8675309',
        description: 'is Jenny there?',
        awsAccountId: 'example-ttutone-81',
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      // OPERATE
      try {
        await service.create({}, index);
        expect.toHaveAssertions();
      } catch (err) {
        // VERIFY
        expect(err.message).toEqual('indexes with id "id-8675309" already exists');
      }
    });

    it('should succeed if the input is valid and the id does not exist', async () => {
      // BUILD

      const index = {
        id: 'id-1985',
        description: 'U2 and Blondie',
        awsAccountId: 'example-BFS-04',
      };

      dbService.table.update.mockReturnValueOnce({ id: 'id-1985' });
      service.audit = jest.fn();

      // OPERATE
      await service.create({}, index);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'create-index', body: { id: 'id-1985' } });
    });
  });

  describe('update', () => {
    it('should fail if id does not exist', async () => {
      // BUILD

      const index = {
        id: 'id-slipp-when-wet',
        description: 'halfway there',
        awsAccountId: 'example-JBJ-86',
        rev: 1,
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      service.find = jest.fn().mockResolvedValue(null);

      // OPERATE
      try {
        await service.update({}, index);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('indexes with id "id-slipp-when-wet" does not exist');
      }
    });

    it('should fail if id has already been updated', async () => {
      // BUILD

      const index = {
        id: 'id-slipp-when-wet',
        description: 'd or a',
        awsAccountId: 'example-JBJ-87',
        rev: 1,
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      service.find = jest.fn().mockResolvedValue({ updatedBy: { username: 'alreadyChanged' } });

      // OPERATE
      try {
        await service.update({}, index);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(
          'indexes information changed just before your request is processed, please try again',
        );
      }
    });

    it('should succeed if the input is valid and the id does not exist', async () => {
      // BUILD

      const index = {
        id: 'id-DSB',
        description: 'a smokey room',
        awsAccountId: 'example-JOUR-81',
        rev: 1,
      };

      dbService.table.update.mockReturnValueOnce({ id: 'id-DSB' });
      service.audit = jest.fn();

      // OPERATE
      await service.update({}, index);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'update-index', body: { id: 'id-DSB' } });
    });

    it('should fail if no value for rev is provided', async () => {
      // BUILD
      const index = {
        id: 'id-BYM',
        description: 'those eyes!',
        awsAccountId: 'example-VM-67',
      };
      // OPERATE
      try {
        await service.update({}, index);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });
  });

  describe('delete', () => {
    it('should fail if id does not exist', async () => {
      // BUILD

      const index = {
        id: 'id-ROCK-3',
        description: 'the last known survivor',
        awsAccountId: 'example-SURV-82',
      };

      dbService.table.delete.mockImplementationOnce(() => {
        throw error;
      });

      // OPERATE
      try {
        await service.delete({}, index);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('indexes with id "id-ROCK-3" does not exist');
      }
    });

    it('should succeed if the input is valid and the id does not exist', async () => {
      // BUILD

      const index = {
        id: 'index-BAD',
        description: 'smooth',
        awsAccountId: 'example-MJ-88',
      };

      dbService.table.update.mockReturnValueOnce({ id: 'index-BAD' });
      service.audit = jest.fn();

      // OPERATE
      await service.delete({}, index);

      // CHECK
      expect(dbService.table.delete).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'delete-index', body: { id: 'index-BAD' } });
    });
  });
});
