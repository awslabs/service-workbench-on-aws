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
const ProjectService = require('../project-service');

describe('ProjectService', () => {
  let service = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('projectService', new ProjectService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('projectService');
  });

  describe('create', () => {
    it('should fail if indexId is empty', async () => {
      const project = {
        id: 'my-new-project',
        description: 'Some relevant description',
        indexId: '', // empty indexId should cause error
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();

      try {
        await service.create({}, project);
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'minLength',
          dataPath: '.indexId',
          message: 'should NOT be shorter than 1 characters',
        });
      }
    });

    it('should fail if projectAdmins is not an object', async () => {
      const project = {
        id: 'my-new-project',
        description: 'Some relevant description',
        indexId: '123',
        projectAdmins: ['test@example.com'], // projectAdmins is not an object list
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();

      try {
        await service.create({}, project);
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'type',
          dataPath: '.projectAdmins[0]',
          message: 'should be object',
        });
      }
    });

    it('should fail if id is empty', async () => {
      const project = {
        id: '', // empty id should cause error
        description: 'Some relevant description',
        indexId: '123',
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();

      try {
        await service.create({}, project);
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'minLength',
          dataPath: '.id',
          message: 'should NOT be shorter than 1 characters',
        });
      }
    });
  });

  describe('update', () => {
    it('should NOT fail for all required properties present', async () => {
      const project = {
        id: 'my-new-project',
        description: 'Some relevant description',
        indexId: '123',
        rev: 1,
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();

      try {
        await service.update({}, project);
        expect.hasAssertions();
        expect(service.update).toHaveBeenCalledTimes();
      } catch (err) {
        expect(err.payload).not.toBeDefined();
      }
    });

    it('should fail if id is empty', async () => {
      const project = {
        id: '', // empty id should cause error
        description: 'Some relevant description',
        indexId: '123',
        rev: 1,
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();

      try {
        await service.update({}, project);
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'minLength',
          dataPath: '.id',
          message: 'should NOT be shorter than 1 characters',
        });
      }
    });
  });

  it('should fail if rev is empty', async () => {
    const project = {
      id: 'my-new-project',
      description: 'Some relevant description',
      indexId: '123',
      // empty rev should cause error
    };

    // Skip authorization
    service.assertAuthorized = jest.fn();

    try {
      await service.update({}, project);
      expect.hasAssertions();
    } catch (err) {
      expect(err.payload).toBeDefined();
      const error = err.payload.validationErrors[0];
      expect(error).toMatchObject({
        keyword: 'required',
        dataPath: '',
        schemaPath: '#/required',
        params: { missingProperty: 'rev' },
        message: "should have required property 'rev'",
      });
    }
  });

  describe('delete', () => {
    it('should NOT fail if an environment is not linked to project', async () => {
      // Skip authorization
      service.assertAuthorized = jest.fn();

      try {
        // 'Test_ID' id is present on the db-service manual mock file.
        // Using that as a project ID reference for delete
        await service.delete({}, { id: 'Not_Test_ID' }); // Different that 'Test_ID'
      } catch (err) {
        expect(err.message).not.toEqual('Deletion could not be completed. Project is linked to existing resources');
      }
    });

    it('should fail if an environment is linked to project', async () => {
      // Skip authorization
      service.assertAuthorized = jest.fn();

      try {
        // 'Test_ID' id is present on the db-service manual mock file.
        // Using that as a project ID reference for delete
        await service.delete({}, { id: 'Test_ID' });
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('Deletion could not be completed. Project is linked to existing resources');
      }
    });
  });
});
