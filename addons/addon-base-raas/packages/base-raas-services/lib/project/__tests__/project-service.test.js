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

jest.mock('@aws-ee/base-services/lib/user/user-service');
const UserServiceMock = require('@aws-ee/base-services/lib/user/user-service');

jest.mock('../../aws-accounts/aws-accounts-service');
const AwsAccountsServiceMock = require('../../aws-accounts/aws-accounts-service');

jest.mock('../../indexes/indexes-service');
const IndexesServiceMock = require('../../indexes/indexes-service');

const ProjectService = require('../project-service');

describe('ProjectService', () => {
  let service = null;
  let dbService = null;
  let indexesService = null;
  let awsAccountsService = null;
  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('projectService', new ProjectService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('indexesService', new IndexesServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('projectService');
    dbService = await container.find('dbService');
    indexesService = await container.find('indexesService');
    awsAccountsService = await container.find('awsAccountsService');

    // Skip authorization
    service.assertAuthorized = jest.fn();
  });

  describe('create', () => {
    it('should fail if indexId is empty', async () => {
      const project = {
        id: 'my-new-project',
        description: 'Some relevant description',
        indexId: '', // empty indexId should cause error
      };

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
        projectAdmins: [{ username: 'un', ns: 'ns' }], // projectAdmins is not an object list, the service expects this to be an array of uid
      };

      try {
        await service.create({}, project);
        expect.hasAssertions();
      } catch (err) {
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'type',
          dataPath: '.projectAdmins[0]',
          message: 'should be string',
        });
      }
    });

    it('should fail if id is empty', async () => {
      const project = {
        id: '', // empty id should cause error
        description: 'Some relevant description',
        indexId: '123',
      };

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

  it('should fail if rev is empty', async () => {
    const project = {
      id: 'my-new-project',
      description: 'Some relevant description',
      indexId: '123',
      // empty rev should cause error
    };

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

  describe('update', () => {
    it('should NOT fail for all required properties present', async () => {
      const project = {
        id: 'my-new-project',
        description: 'Some relevant description',
        indexId: '123',
        rev: 1,
      };

      // Happy-path: Make sure no exceptions are thrown
      await expect(() => service.update({}, project)).not.toThrow();
    });

    it('should fail if id is empty', async () => {
      const project = {
        id: '', // empty id should cause error
        description: 'Some relevant description',
        indexId: '123',
        rev: 1,
      };

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

  describe('updateWithAppStreamConfig', () => {
    it('should return list of projects with appropriate isAppStreamConfigured bool', async () => {
      // BUILD
      const input = [
        {
          id: 'my-appstream-project',
          description: 'Some relevant description',
          indexId: 'index-1',
          rev: 1,
        },
        {
          id: 'my-non-appstream-project',
          description: 'Some relevant description',
          indexId: 'index-2',
          rev: 1,
        },
      ];
      awsAccountsService.list = jest.fn(() => {
        return [
          {
            id: 'awsAccountId-1',
            appStreamFleetName: 'sampleAppStreamFleetName',
            appStreamSecurityGroupId: 'sampleAppStreamSecurityGroupId',
            appStreamStackName: 'sampleAppStreamStackName',
          },
          { id: 'awsAccountId-2' },
          { id: 'awsAccountId-3' },
        ];
      });
      indexesService.list = jest.fn(() => {
        return [
          { id: 'index-1', awsAccountId: 'awsAccountId-1' },
          { id: 'index-2', awsAccountId: 'awsAccountId-2' },
          { id: 'index-3', awsAccountId: 'awsAccountId-3' },
        ];
      });
      const expectedRetVal = [
        {
          id: 'my-appstream-project',
          description: 'Some relevant description',
          indexId: 'index-1',
          rev: 1,
          isAppStreamConfigured: true,
        },
        {
          id: 'my-non-appstream-project',
          description: 'Some relevant description',
          indexId: 'index-2',
          rev: 1,
          isAppStreamConfigured: false,
        },
      ];

      // EXECUTE
      const retVal = await service.updateWithAppStreamConfig(input);

      // CHECK
      await expect(retVal).toEqual(expectedRetVal);
    });

    it('should return project with appropriate isAppStreamConfigured bool', async () => {
      // BUILD
      const input = {
        id: 'my-appstream-project',
        description: 'Some relevant description',
        indexId: 'index-1',
        rev: 1,
      };
      awsAccountsService.list = jest.fn(() => {
        return [
          {
            id: 'awsAccountId-1',
            appStreamFleetName: 'sampleAppStreamFleetName',
            appStreamSecurityGroupId: 'sampleAppStreamSecurityGroupId',
            appStreamStackName: 'sampleAppStreamStackName',
          },
          { id: 'awsAccountId-2' },
          { id: 'awsAccountId-3' },
        ];
      });
      indexesService.list = jest.fn(() => {
        return [
          { id: 'index-1', awsAccountId: 'awsAccountId-1' },
          { id: 'index-2', awsAccountId: 'awsAccountId-2' },
          { id: 'index-3', awsAccountId: 'awsAccountId-3' },
        ];
      });
      const expectedRetVal = {
        id: 'my-appstream-project',
        description: 'Some relevant description',
        indexId: 'index-1',
        rev: 1,
        isAppStreamConfigured: true,
      };

      // EXECUTE
      const retVal = await service.updateWithAppStreamConfig(input);

      // CHECK
      await expect(retVal).toEqual(expectedRetVal);
    });

    it('should return project with unset isAppStreamConfigured for incomplete AppStream configuration', async () => {
      // BUILD
      const input = {
        id: 'my-appstream-project',
        description: 'Some relevant description',
        indexId: 'index-1',
        rev: 1,
      };
      awsAccountsService.list = jest.fn(() => {
        return [
          {
            id: 'awsAccountId-1',
            appStreamFleetName: 'sampleAppStreamFleetName',
            appStreamSecurityGroupId: 'sampleAppStreamSecurityGroupId',
            // appStreamStackName: 'sampleAppStreamStackName', // missing config
          },
          { id: 'awsAccountId-2' },
          { id: 'awsAccountId-3' },
        ];
      });
      indexesService.list = jest.fn(() => {
        return [
          { id: 'index-1', awsAccountId: 'awsAccountId-1' },
          { id: 'index-2', awsAccountId: 'awsAccountId-2' },
          { id: 'index-3', awsAccountId: 'awsAccountId-3' },
        ];
      });
      const expectedRetVal = {
        id: 'my-appstream-project',
        description: 'Some relevant description',
        indexId: 'index-1',
        rev: 1,
        isAppStreamConfigured: false,
      };

      // EXECUTE
      const retVal = await service.updateWithAppStreamConfig(input);

      // CHECK
      await expect(retVal).toEqual(expectedRetVal);
    });
  });

  describe('delete', () => {
    it('should NOT fail if an environment is not linked to project', async () => {
      dbService.table.scan.mockReturnValueOnce([{ id: 'Test_ID' }]);
      await expect(() => service.delete({}, { id: 'Not_Test_ID' })).not.toThrow(); // Different that 'Test_ID'
    });

    it('should fail if an environment is linked to project', async () => {
      try {
        dbService.table.scan.mockReturnValueOnce([{ id: 'Test_ID' }]);
        await service.delete({}, { id: 'Test_ID' });
        expect.hasAssertions();
      } catch (err) {
        expect(err).toEqual(
          service.boom.badRequest('Deletion could not be completed. Project is linked to existing resources'),
        );
      }
    });
  });
});
