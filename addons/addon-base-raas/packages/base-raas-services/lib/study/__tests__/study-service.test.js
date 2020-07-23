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
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/s3-service');
const S3ServiceMock = require('@aws-ee/base-services/lib/s3-service');

jest.mock('../study-permission-service');
const StudyPermissionServiceMock = require('../study-permission-service');

jest.mock('../../project/project-service');
const ProjectServiceMock = require('../../project/project-service');

const StudyService = require('../study-service');

// Tested functions: create, update, delete
describe('studyService', () => {
  let service = null;
  let dbService = null;
  let projectService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    const container = new ServicesContainer();

    container.register('S3', new S3ServiceMock());
    container.register('aws', new AwsService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('studyPermissionService', new StudyPermissionServiceMock());
    container.register('projectService', new ProjectServiceMock());

    container.register('studyService', new StudyService());

    container.initServices();
    service = await container.find('studyService');
    dbService = await container.find('dbService');
    projectService = await container.find('projectService');
  });

  describe('create', () => {
    it('should fail due to missing id', async () => {
      // BUILD
      const ipt = {
        name: 'porky pig',
        category: 'My Studies',
      };

      // OPERATE
      try {
        await service.create({ principal: { userRole: 'admin' } }, ipt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail due to missing projectId on non-Open Data call', async () => {
      // BUILD
      const dataIpt = {
        id: '4 score and 7 years ago',
        category: 'Organization',
      };

      // OPERATE
      try {
        await service.create({ principal: { userRole: 'admin' } }, dataIpt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Missing required projectId');
      }
    });

    it('should fail for users other than admin or internal-researcher ', async () => {
      // BUILD
      const dataIpt = {
        id: '4 score and 7 years ago',
        projectId: 'some_project_id',
        category: 'Organization',
      };

      // OPERATE
      try {
        await service.create({ principal: { userRole: 'internal-guest' } }, dataIpt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Only admin and internal researcher are authorized to create studies. ');
      }
    });

    it('should fail if user project association is missing', async () => {
      // BUILD
      const dataIpt = {
        id: '4 score and 7 years ago',
        projectId: 'some_project_id',
        category: 'Organization',
      };

      projectService.verifyUserProjectAssociation.mockImplementationOnce(() => false);

      // OPERATE
      try {
        await service.create({ principal: { userRole: 'admin' } }, dataIpt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Not authorized to add study related to project "some_project_id"');
      }
    });

    it('should fail due to study id already existing', async () => {
      // BUILD
      const dataIpt = {
        id: 'doppelganger',
        category: 'Open Data',
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.create({ principal: { userRole: 'admin' } }, dataIpt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('study with id "doppelganger" already exists');
      }
    });

    it('should try to create the study successfully', async () => {
      // BUILD
      const dataIpt = {
        id: 'doppelganger',
        category: 'Open Data',
      };

      service.audit = jest.fn();

      // OPERATE
      await service.create({ principal: { userRole: 'admin' } }, dataIpt);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        { principal: { userRole: 'admin' } },
        { action: 'create-study', body: undefined },
      );
    });
  });

  describe('update', () => {
    it('should fail due to missing rev', async () => {
      // BUILD
      const ipt = {
        name: 'tasDevil',
      };

      // OPERATE
      try {
        await service.update({}, ipt);
        expect.hasAssertions();
      } catch (err) {
        // CATCH
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail due to study not existing', async () => {
      // BUILD
      const dataIpt = {
        id: 'doppelganger',
        rev: 1,
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      service.find = jest.fn().mockImplementationOnce(() => {
        return undefined;
      });

      // OPERATE
      try {
        await service.update({}, dataIpt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('study with id "doppelganger" does not exist');
      }
    });

    it('should fail due to study having already been updated', async () => {
      // BUILD
      const dataIpt = {
        id: 'doppelganger',
        rev: 1,
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      service.find = jest.fn().mockImplementationOnce(() => {
        return { updatedBy: { username: 'another doppelganger' } };
      });

      // OPERATE
      try {
        await service.update({}, dataIpt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(
          'study information changed by "another doppelganger" just before your request is processed, please try again',
        );
      }
    });

    it('should succeed', async () => {
      // BUILD
      const dataIpt = {
        id: 'doppelganger',
        rev: 1,
      };
      service.audit = jest.fn();

      // OPERATE
      await service.update({}, dataIpt);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'update-study', body: undefined });
    });
  });

  describe('delete', () => {
    it('should fail due to study id already existing', async () => {
      // BUILD
      dbService.table.delete.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.delete({}, 'projectId');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('study with id "projectId" does not exist');
      }
    });

    it('should try to delete the study successfully', async () => {
      // BUILD
      service.audit = jest.fn();

      // OPERATE
      await service.delete({}, 'projectId');

      // CHECK
      expect(dbService.table.delete).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'delete-study', body: { id: 'projectId' } });
    });
  });
});
