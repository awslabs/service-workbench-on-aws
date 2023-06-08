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

const _ = require('lodash');
const ServicesContainer = require('@amzn/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@amzn/base-services/lib/json-schema-validation-service');
const AwsService = require('@amzn/base-services/lib/aws/aws-service');
const { getSystemRequestContext } = require('@amzn/base-services/lib/helpers/system-context');

jest.mock('@amzn/base-services/lib/db-service');
jest.mock('@amzn/base-services/lib/logger/logger-service');
jest.mock('@amzn/base-services/lib/audit/audit-writer-service');
jest.mock('@amzn/base-services/lib/settings/env-settings-service');
jest.mock('@amzn/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@amzn/base-services/lib/s3-service');
jest.mock('@amzn/base-services/lib/lock/lock-service');
jest.mock('../../user/user-service');
jest.mock('../../project/project-service');

const Logger = require('@amzn/base-services/lib/logger/logger-service');
const LockService = require('@amzn/base-services/lib/lock/lock-service');
const DbServiceMock = require('@amzn/base-services/lib/db-service');
const AuthService = require('@amzn/base-services/lib/authorization/authorization-service');
const AuditServiceMock = require('@amzn/base-services/lib/audit/audit-writer-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');
const PluginRegistryService = require('@amzn/base-services/lib/plugin-registry/plugin-registry-service');
const S3ServiceMock = require('@amzn/base-services/lib/s3-service');
const ProjectServiceMock = require('../../project/project-service');
const UserService = require('../../user/user-service');
const StudyPermissionService = require('../study-permission-service');
const StudyService = require('../study-service');

const { getEmptyUserPermissions } = require('../helpers/entities/user-permissions-methods');
const { getEmptyStudyPermissions } = require('../helpers/entities/study-permissions-methods');

function setupDbUpdate(dbService, entity) {
  let pKey;
  dbService.table.key = jest.fn(({ id }) => {
    pKey = id;
    return dbService.table;
  });

  dbService.table.update = jest.fn(() => {
    if (pKey !== entity.id) return undefined;
    return entity;
  });
}

describe('studyService', () => {
  let service = null;
  let dbService = null;
  let projectService = null;
  let studyPermissionService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    const container = new ServicesContainer();

    container.register('S3', new S3ServiceMock());
    container.register('aws', new AwsService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('log', new Logger());
    container.register('lockService', new LockService());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('userService', new UserService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('studyPermissionService', new StudyPermissionService());
    container.register('projectService', new ProjectServiceMock());
    container.register('studyService', new StudyService());

    container.initServices();
    service = await container.find('studyService');
    dbService = await container.find('dbService');
    projectService = await container.find('projectService');
    studyPermissionService = await container.find('studyPermissionService');
  });

  describe('getStudyPermissions', () => {
    it('should return a study entity with the permissions attribute populated', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1', accessType: 'readonly' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [uid],
        readwriteUsers: [uid],
      };

      let pKey1;
      let pKey2;
      dbService.table.key = jest
        .fn()
        .mockImplementationOnce(({ id }) => {
          pKey1 = id;
          return dbService.table;
        })
        .mockImplementationOnce(({ id }) => {
          pKey2 = id;
          return dbService.table;
        });

      dbService.table.get = jest
        .fn()
        .mockImplementationOnce(() => {
          if (pKey1 !== studyEntity.id) return undefined;
          return studyEntity;
        })
        .mockImplementationOnce(() => {
          if (pKey2 !== dbPermissionsEntity.id) return undefined;
          return dbPermissionsEntity;
        });

      await expect(service.getStudyPermissions(requestContext, studyEntity.id)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
        permissions: { adminUsers: [], readonlyUsers: [uid], readwriteUsers: [], writeonlyUsers: [] },
      });
    });
    it('should fail since the given study id is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      // OPERATE
      await expect(service.getStudyPermissions(requestContext, '<hack>')).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });

  describe('getUserPermissions', () => {
    it('should return a user permissions entity', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const dbPermissionsEntity = { id: `User:${uid}`, uid, recordType: 'user', adminAccess: ['study-1'] };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.getUserPermissions(requestContext, uid)).resolves.toStrictEqual({
        ...getEmptyUserPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id', 'uid']),
        uid,
      });
    });
  });

  describe('register', () => {
    // TODO add positive tests
    it('should fail if study path is a wildcard *', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'asas',
        projectId: 'project1',
        folder: '*',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail due to missing projectId', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'asas',
        folder: 'folder',
        // projectId: missing
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail if study path has wildcard *', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'asas',
        projectId: 'project1',
        folder: 'folder*',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail if study path has wildcard ?', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'valid',
        projectId: 'project1',
        folder: 'folder?',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail due to invalid id', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1<hack>',
        name: 'study-1',
        category: 'Organization',
        description: 'valid',
        projectId: 'project1',
        folder: 'folder',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail due to invalid name', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1<hack>',
        category: 'Organization',
        description: 'valid',
        projectId: 'project1',
        folder: 'folder',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail due to invalid description', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'valid<hack>',
        projectId: 'project1',
        folder: 'folder',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail due to invalid folder', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'valid',
        projectId: 'project1',
        folder: 'folder<hack>',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail due to invalid kmsArn', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'valid',
        projectId: 'project1',
        folder: 'folder',
        kmsArn: 'invalid',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail due to unsafe name', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: '<script>console.log("unsafe code")</script>',
        category: 'Organization',
        description: 'valid',
        projectId: 'project1',
        folder: 'folder',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readonly',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail due to egress store feautre is enabled and access type is readwrite', async () => {
      // BUILD
      service._settings = {
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { isAdmin: true, userRole: 'admin', status: 'active' },
      };
      const accountEntity = {};
      const bucketEntity = {};
      const rawStudyEntity = {
        id: 'study-1',
        name: 'study-1',
        category: 'Organization',
        description: 'valid',
        projectId: 'project1',
        folder: 'folder',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        kmsScope: 'bucket',
        adminUsers: ['admin'],
        accessType: 'readwrite',
      };
      // OPERATE
      await expect(service.register(requestContext, accountEntity, bucketEntity, rawStudyEntity)).rejects.toThrow(
        // CHECK
        expect.objectContaining({
          boom: true,
          code: 'forbidden',
          safe: true,
          message: 'Only READ access type is allowed when egress data feature is enabled',
        }),
      );
    });
  });

  describe('create', () => {
    it('should succeed for valid open data record', async () => {
      // BUILD
      const systemContext = getSystemRequestContext();
      const studyData = {
        description: 'Example study 1',
        id: 'study-2',
        name: 'Study 1',
        resources: [
          {
            arn: 'arn:aws:s3:::study1',
          },
        ],
        sha: '19d5b9c735712185ca1c691143e458a7aa2b7f69',
        category: 'Open Data',
      };
      dbService.table.update.mockResolvedValueOnce(studyData);

      // OPERATE
      await expect(service.create(systemContext, studyData)).resolves.toMatchObject(studyData);
    });
    it('should fail for invalid open data record', async () => {
      // BUILD
      const systemContext = getSystemRequestContext();
      const studyData = {
        description: 'Example study 1',
        id: 'study-2',
        name: 'Study 1',
        resources: [
          {
            arn: 'arn:aws:s3:::study1',
          },
        ],
        sha: '19d5b9z735712185ca1c691143t458a7aa2b7f69',
        category: 'Open Data',
      };

      // OPERATE
      try {
        await service.create(systemContext, studyData);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });
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
        id: '4Scoreand7YearsAgo',
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
      const dataIpt = {
        id: '4Scoreand7YearsAgo',
        projectId: 'some_project_id',
        category: 'Organization',
      };

      await expect(service.create({ principal: { userRole: 'internal-guest' } }, dataIpt)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should fail if user project association is missing', async () => {
      // BUILD
      const dataIpt = {
        id: '4Scoreand7YearsAgo',
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
        await service.create({ principal: { userRole: 'admin' }, principalIdentifier: { uid: '_system_' } }, dataIpt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('study with id "doppelganger" already exists');
      }
    });

    it('should fail if non-system user is trying to create Open Data study', async () => {
      // BUILD
      const dataIpt = {
        id: 'newOpenStudy',
        category: 'Open Data',
      };

      // OPERATE
      try {
        await service.create(
          { principal: { userRole: 'admin' }, principalIdentifier: { uid: 'someRandomUserUid' } },
          dataIpt,
        );
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Only the system can create Open Data studies.');
      }
    });

    it('should pass if system is trying to create Open Data study', async () => {
      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid: '_system_' },
      };
      const studyEntity = { id: 'newOpenStudy', category: 'Open Data' };
      setupDbUpdate(dbService, studyEntity);

      await expect(service.create(requestContext, studyEntity)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
      });
    });

    it('should fail if non-Open Data study type has non-empty resources list', async () => {
      const studyEntity = {
        id: 'newOpenStudy',
        category: 'Organization',
        projectId: 'existingProjId',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      projectService.verifyUserProjectAssociation.mockImplementationOnce(() => true);

      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid: 'someRandomUserUid' },
      };
      setupDbUpdate(dbService, studyEntity);

      await expect(service.create(requestContext, studyEntity)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should pass if Open Data study type has non-empty resources list', async () => {
      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid: '_system_' },
      };
      const studyEntity = {
        id: 'newOpenStudy',
        category: 'Open Data',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      setupDbUpdate(dbService, studyEntity);

      await expect(service.create(requestContext, studyEntity)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
      });
    });

    it('should try to create the open data study successfully', async () => {
      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid: '_system_' },
      };
      const studyEntity = {
        id: 'doppelganger',
        category: 'Open Data',
      };
      setupDbUpdate(dbService, studyEntity);

      await expect(service.create(requestContext, studyEntity)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
      });
    });

    it('should try to create the study successfully when accessType is readonly', async () => {
      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid: 'u-something' },
      };
      const studyEntity = {
        id: 'doppelganger',
        category: 'Organization',
        accessType: 'readonly',
        projectId: 'p1',
      };

      projectService.verifyUserProjectAssociation.mockImplementationOnce(() => true);
      setupDbUpdate(dbService, studyEntity);

      await expect(service.create(requestContext, studyEntity)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
        permissions: getEmptyStudyPermissions(),
      });
    });

    it('should try to create the study successfully when accessType is readwrite for My Studies', async () => {
      const uid = 'u-something';
      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid },
      };
      const sid = 'doppelganger';
      const studyEntity = {
        id: sid,
        category: 'My Studies',
        accessType: 'readwrite',
        projectId: 'p1',
      };

      projectService.verifyUserProjectAssociation.mockImplementationOnce(() => true);
      let pKey1;
      let pKey2;
      dbService.table.key = jest
        .fn()
        .mockImplementationOnce(({ id }) => {
          pKey1 = id;
          return dbService.table;
        })
        .mockImplementationOnce(({ id }) => {
          pKey2 = id;
          return dbService.table;
        })
        .mockImplementationOnce(() => {
          // Covers the call to get the User PermissionsEntity
          return dbService.table;
        })
        .mockImplementationOnce(() => {
          // Covers the call to update the User PermissionsEntity
          return dbService.table;
        });

      dbService.table.update = jest
        .fn()
        .mockImplementationOnce(() => {
          if (pKey1 !== sid) return undefined;
          return studyEntity;
        })
        .mockImplementationOnce(() => {
          if (pKey2 !== `Study:${sid}`) return undefined;
          return { adminUsers: [uid] };
        });

      await expect(service.create(requestContext, studyEntity)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
        permissions: { ...getEmptyStudyPermissions(), adminUsers: [uid] },
      });
    });

    it('should try to create the study successfully when accessType is readwrite for Organization', async () => {
      const uid = 'u-something';
      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid },
      };
      const sid = 'doppelganger';
      const studyEntity = {
        id: sid,
        category: 'Organization',
        accessType: 'readwrite',
        projectId: 'p1',
      };

      projectService.verifyUserProjectAssociation.mockImplementationOnce(() => true);
      let pKey1;
      let pKey2;
      dbService.table.key = jest
        .fn()
        .mockImplementationOnce(({ id }) => {
          pKey1 = id;
          return dbService.table;
        })
        .mockImplementationOnce(({ id }) => {
          pKey2 = id;
          return dbService.table;
        })
        .mockImplementationOnce(() => {
          // Covers the call to get the User PermissionsEntity
          return dbService.table;
        })
        .mockImplementationOnce(() => {
          // Covers the call to update the User PermissionsEntity
          return dbService.table;
        });

      dbService.table.update = jest
        .fn()
        .mockImplementationOnce(() => {
          if (pKey1 !== sid) return undefined;
          return studyEntity;
        })
        .mockImplementationOnce(() => {
          if (pKey2 !== `Study:${sid}`) return undefined;
          return { adminUsers: [uid] };
        });

      await expect(service.create(requestContext, studyEntity)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
        permissions: { ...getEmptyStudyPermissions(), adminUsers: [uid] },
      });
    });

    it('should fail because accessType specified is ReadOnly in camelcase', async () => {
      // BUILD
      const ipt = {
        name: 'doppelganger',
        category: 'My Studies',
        accessType: 'ReadOnly',
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

    it('should fail because accessType specified is random', async () => {
      // BUILD
      const ipt = {
        name: 'doppelganger',
        category: 'My Studies',
        accessType: 'random',
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

    it('should fail because accessType is readwrite for Open Data', async () => {
      // BUILD
      projectService.verifyUserProjectAssociation = jest.fn().mockImplementationOnce(() => {
        return true;
      });
      const ipt = {
        id: 'doppelganger',
        category: 'Open Data',
        accessType: 'readwrite',
        projectId: 'some_project_id',
      };

      // OPERATE
      try {
        await service.create({ principal: { userRole: 'admin' }, principalIdentifier: { uid: '_system_' } }, ipt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Open Data study cannot be read/write');
      }
    });

    it('should fail since the given study id is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const dataIpt = {
        id: '<hack>',
        name: 'name',
        category: 'Organization',
        description: 'desc',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      // OPERATE
      await expect(service.create(requestContext, dataIpt)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail since the given study name is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const dataIpt = {
        id: 'id',
        name: '<hack>',
        category: 'Organization',
        description: 'desc',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      // OPERATE
      await expect(service.create(requestContext, dataIpt)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail since the given study sha is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const dataIpt = {
        id: 'id',
        name: 'name',
        category: 'Organization',
        description: 'desc',
        sha: 'fake',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      // OPERATE
      await expect(service.create(requestContext, dataIpt)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });

  describe('update', () => {
    it('should succeed for valid open data record', async () => {
      // BUILD
      const systemContext = getSystemRequestContext();
      const studyData = {
        description: 'Example study 1',
        id: 'study-2',
        name: 'Study 1',
        resources: [
          {
            arn: 'arn:aws:s3:::study1',
          },
        ],
        sha: '19d5b9c735712185ca1c691143e458a7aa2b7f69',
        rev: 0,
      };
      dbService.table.update.mockResolvedValueOnce(studyData);
      service.getStudyPermissions = jest.fn().mockResolvedValueOnce({
        ...studyData,
        category: 'Open Data',
        status: 'reachable',
        permissions: { adminUsers: [], readonlyUsers: [], readwriteUsers: [], writeonlyUsers: [] },
      });

      // OPERATE
      await expect(service.update(systemContext, studyData)).resolves.toMatchObject(studyData);
    });
    it('should fail for invalid open data record', async () => {
      // BUILD
      const systemContext = getSystemRequestContext();
      const studyData = {
        description: 'Example study 1',
        id: 'study-2',
        name: 'Study 1',
        resources: [
          {
            arn: 'arn:aws:s3:::study1',
          },
        ],
        sha: '19d5b9z735712185ca1c691143t458a7aa2b7f69',
        rev: 0,
      };

      // OPERATE
      try {
        await service.update(systemContext, studyData);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });
    it('should fail since the given study id is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const dataIpt = {
        id: '<hack>',
        name: 'name',
        description: 'desc',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      // OPERATE
      await expect(service.update(requestContext, dataIpt)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail since the given study name is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const dataIpt = {
        id: 'id',
        name: '<hack>',
        description: 'desc',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      // OPERATE
      await expect(service.update(requestContext, dataIpt)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail since the given sha is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const dataIpt = {
        id: 'id',
        name: 'name',
        description: 'desc',
        sha: 'fake',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      // OPERATE
      await expect(service.update(requestContext, dataIpt)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

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
        expect(err.message).toEqual('Study with id "doppelganger" does not exist');
      }
    });

    it('should fail if non-system user is trying to update Open Data study', async () => {
      // BUILD
      const dataIpt = {
        id: 'existingOpenStudy',
        rev: 1,
      };

      service.find = jest.fn().mockImplementationOnce(() => {
        return { id: 'existingOpenStudy', updatedBy: { username: 'another doppelganger' }, category: 'Open Data' };
      });
      studyPermissionService.findStudyPermissions = jest.fn().mockImplementationOnce(() => {
        return getEmptyStudyPermissions();
      });

      // OPERATE
      try {
        await service.update(
          { principal: { userRole: 'admin' }, principalIdentifier: { uid: 'someRandomUserUid' } },
          dataIpt,
        );
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Only the system can update Open Data studies.');
      }
    });

    it('should pass if a researcher who is a study admin is trying to update', async () => {
      // BUILD
      const dataIpt = {
        id: 'existingOrgStudy',
        rev: 1,
      };

      service.find = jest.fn().mockImplementationOnce(() => {
        return { id: 'existingOrgStudy', updatedBy: { username: 'another doppelganger' }, category: 'Organization' };
      });
      studyPermissionService.findStudyPermissions = jest.fn().mockImplementationOnce(() => {
        const studyPermissions = getEmptyStudyPermissions();
        studyPermissions.adminUsers = ['u-123'];
        return studyPermissions;
      });

      service.audit = jest.fn();

      // OPERATE
      await service.update({ principal: { userRole: 'researcher' }, principalIdentifier: { uid: 'u-123' } }, dataIpt);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        { principal: { userRole: 'researcher' }, principalIdentifier: { uid: 'u-123' } },
        { action: 'update-study', body: undefined },
      );
    });

    it('should pass if system is trying to update Open Data study', async () => {
      // BUILD
      const dataIpt = {
        id: 'existingOpenStudy',
        rev: 1,
      };

      service.find = jest.fn().mockImplementationOnce(() => {
        return { id: 'existingOpenStudy', updatedBy: { username: 'another doppelganger' }, category: 'Open Data' };
      });
      studyPermissionService.findStudyPermissions = jest.fn().mockImplementationOnce(() => {
        return getEmptyStudyPermissions();
      });

      service.audit = jest.fn();

      // OPERATE
      await service.update({ principal: { userRole: 'admin' }, principalIdentifier: { uid: '_system_' } }, dataIpt);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        { principal: { userRole: 'admin' }, principalIdentifier: { uid: '_system_' } },
        { action: 'update-study', body: undefined },
      );
    });

    it('should fail if non Open Data study type has non-empty resources list', async () => {
      // BUILD
      const dataIpt = {
        id: 'existingOrgStudy',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
        rev: 1,
      };

      service.find = jest.fn().mockImplementationOnce(() => {
        return { id: 'existingOrgStudy', updatedBy: { username: 'another doppelganger' }, category: 'Organization' };
      });
      studyPermissionService.findStudyPermissions = jest.fn().mockImplementationOnce(() => {
        return getEmptyStudyPermissions();
      });

      projectService.verifyUserProjectAssociation.mockImplementationOnce(() => true);

      // OPERATE
      try {
        await service.update(
          { principal: { userRole: 'admin' }, principalIdentifier: { uid: 'someRandomUserUid' } },
          dataIpt,
        );
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Resources can only be updated for Open Data study category');
      }
    });
  });

  describe('list', () => {
    it('should create Study Access Map according to user-study permissions: Admins and R/W', async () => {
      // BUILD
      const permissions = {
        adminAccess: ['studyA'],
        readwriteAccess: ['studyA'],
      };
      const expectedVal = { studyA: ['admin', 'readwrite'] };
      jest.spyOn(service, '_getStudyAccessMap');

      // OPERATE
      const retVal = service._getStudyAccessMap(permissions);
      // CHECK
      expect(retVal).toEqual(expectedVal);
    });

    it('should create Study Access Map according to user-study permissions: Admins and R/O', async () => {
      // BUILD
      const permissions = {
        adminAccess: ['studyA'],
        readonlyAccess: ['studyA'],
      };
      const expectedVal = { studyA: ['admin', 'readonly'] };
      jest.spyOn(service, '_getStudyAccessMap');

      // OPERATE
      const retVal = service._getStudyAccessMap(permissions);
      // CHECK
      expect(retVal).toEqual(expectedVal);
    });

    it('should create Study Access Map according to user-study permissions: Admins only', async () => {
      // BUILD
      const permissions = {
        adminAccess: ['studyA', 'studyB'],
      };
      const expectedVal = { studyA: ['admin'], studyB: ['admin'] };
      jest.spyOn(service, '_getStudyAccessMap');

      // OPERATE
      const retVal = service._getStudyAccessMap(permissions);
      // CHECK
      expect(retVal).toEqual(expectedVal);
    });

    it('should create Study Access Map according to user-study permissions: R/W only', async () => {
      // BUILD
      const permissions = {
        readwriteAccess: ['studyA', 'studyB'],
      };
      const expectedVal = { studyA: ['readwrite'], studyB: ['readwrite'] };
      jest.spyOn(service, '_getStudyAccessMap');

      // OPERATE
      const retVal = service._getStudyAccessMap(permissions);
      // CHECK
      expect(retVal).toEqual(expectedVal);
    });

    it('should create Study Access Map according to user-study permissions: R/O only', async () => {
      // BUILD
      const permissions = {
        readonlyAccess: ['studyA', 'studyB'],
      };
      const expectedVal = { studyA: ['readonly'], studyB: ['readonly'] };
      jest.spyOn(service, '_getStudyAccessMap');

      // OPERATE
      const retVal = service._getStudyAccessMap(permissions);
      // CHECK
      expect(retVal).toEqual(expectedVal);
    });
  });

  describe('isOverlapping', () => {
    it('should return true if new study has overlapping root path with existing ones', async () => {
      // BUILD
      const requestContext = 'dummyRequestContext';
      const bucketName = 'testBucket';
      const accountId = '123456789012';
      const folder = '/';

      service.listStudiesForAccount = jest.fn(() => {
        return [{ bucket: 'testBucket', folder: 'study-1/' }];
      });

      // OPERATE
      const retVal = await service.isOverlapping(requestContext, accountId, bucketName, folder);
      // CHECK
      expect(retVal).toEqual(true);
    });

    it('should return true if new study has overlapping path with existing ones', async () => {
      // BUILD
      const requestContext = 'dummyRequestContext';
      const bucketName = 'testBucket';
      const accountId = '123456789012';
      const folder = '/testFolder';

      service.listStudiesForAccount = jest.fn(() => {
        return [{ bucket: 'testBucket', folder: 'testFolder/study-2/' }];
      });

      // OPERATE
      const retVal = await service.isOverlapping(requestContext, accountId, bucketName, folder);
      // CHECK
      expect(retVal).toEqual(true);
    });

    it('should return false if new study has non-overlapping path with existing ones', async () => {
      // BUILD
      const requestContext = 'dummyRequestContext';
      const bucketName = 'testBucket';
      const accountId = '123456789012';
      const folder = '/testFolder/study-2';

      service.listStudiesForAccount = jest.fn(() => {
        return [{ bucket: 'testBucket', folder: 'testFolder/study-1/' }];
      });

      // OPERATE
      const retVal = await service.isOverlapping(requestContext, accountId, bucketName, folder);
      // CHECK
      expect(retVal).toEqual(false);
    });
  });

  describe('updatePermissions', () => {
    it('should throw error if My Study but not migration request', async () => {
      // BUILD
      const studyId = 'sampleMyStudy';
      const updateRequest = {
        usersToAdd: [
          {
            uid: 'u-1',
            permissionLevel: 'admin',
          },
        ],
        usersToRemove: [
          {
            uid: 'u-2',
            permissionLevel: 'admin',
          },
        ],
      };
      const studyEntity = { id: studyId, category: 'My Studies' };
      const requestContext = { sampleMyStudy: studyEntity };
      service.find = jest.fn(() => {
        return studyEntity;
      });

      // UPDATE n CHECK
      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).rejects.toThrow(
        'Permissions cannot be set for studies in the "My Studies" category',
      );
    });

    it('should call update if My Study and migration request', async () => {
      // BUILD
      const studyId = 'sampleMyStudy';
      const updateRequest = {
        usersToAdd: [
          {
            uid: 'u-1',
            permissionLevel: 'admin',
          },
        ],
        usersToRemove: [
          {
            uid: '*',
            permissionLevel: 'admin',
          },
        ],
      };
      const studyEntity = { id: studyId, category: 'My Studies' };
      const requestContext = { sampleMyStudy: studyEntity, isMigration: true };
      service.find = jest.fn(() => {
        return studyEntity;
      });
      studyPermissionService.update = jest.fn().mockImplementationOnce(() => {
        return {};
      });

      // UPDATE
      await service.updatePermissions(requestContext, studyId, updateRequest);

      // CHECK
      expect(studyPermissionService.update).toHaveBeenCalledTimes(1);
      expect(studyPermissionService.update).toHaveBeenCalledWith(requestContext, studyEntity, updateRequest);
    });
  });

  describe('isStudyAdmin', () => {
    it('should return true when user is study admin', async () => {
      // BUILD
      const requestContext = 'dummyRequestContext';
      const uid = 'sample-user';
      const studyId = 'sample-study';
      service.getStudyPermissions = jest.fn().mockImplementationOnce(() => {
        return { permissions: { adminUsers: [uid] } };
      });

      // OPERATE
      const result = await service.isStudyAdmin(requestContext, studyId, uid);

      // CHECK
      expect(result).toBeTruthy();
    });

    it('should return false when user is not study admin', async () => {
      // BUILD
      const requestContext = 'dummyRequestContext';
      const uid = 'sample-user';
      const studyId = 'sample-study';
      service.getStudyPermissions = jest.fn().mockImplementationOnce(() => {
        return { permissions: { adminUsers: ['some-other-user'] } };
      });

      // OPERATE
      const result = await service.isStudyAdmin(requestContext, studyId, uid);

      // CHECK
      expect(result).toBeFalsy();
    });
  });

  describe('Create Study', () => {
    it('should fail when the researcher is tries to create study', async () => {
      const studyData = {
        description: 'Example study 1',
        id: 'study-2',
        name: 'Study 1',
        resources: [
          {
            arn: 'arn:aws:s3:::study1',
          },
        ],
        sha: '19d5b9z735712185ca1c691143t458a7aa2b7f69',
        category: 'My Studies',
      };
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      service._settings = {
        getBoolean: settingName => {
          if (settingName === 'disableStudyUploadByResearcher') {
            return true;
          }
          return undefined;
        },
      };
      // OPERATE
      await expect(service.create(requestContext, studyData)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ message: 'Only admin are authorized to create studies.' }),
      );
    });

    it('should pass when the researcher is tries to create study', async () => {
      service._settings = {
        getBoolean: settingName => {
          if (settingName === 'disableStudyUploadByResearcher') {
            return false;
          }
          return undefined;
        },
      };
      const sid = 'doppelganger';
      const uid = 'u-currentUserId';
      const requestContext = {
        principal: { userRole: 'admin', status: 'active' },
        principalIdentifier: { uid: '_system_' },
      };
      const studyEntity = {
        id: sid,
        category: 'My Studies',
        accessType: 'readwrite',
        projectId: 'p1',
      };
      projectService.verifyUserProjectAssociation.mockImplementationOnce(() => true);
      let pKey1;
      let pKey2;
      dbService.table.key = jest
        .fn()
        .mockImplementationOnce(({ id }) => {
          pKey1 = id;
          return dbService.table;
        })
        .mockImplementationOnce(({ id }) => {
          pKey2 = id;
          return dbService.table;
        })
        .mockImplementationOnce(() => {
          // Covers the call to get the User PermissionsEntity
          return dbService.table;
        })
        .mockImplementationOnce(() => {
          // Covers the call to update the User PermissionsEntity
          return dbService.table;
        });

      dbService.table.update = jest
        .fn()
        .mockImplementationOnce(() => {
          if (pKey1 !== sid) return undefined;
          return studyEntity;
        })
        .mockImplementationOnce(() => {
          if (pKey2 !== `Study:${sid}`) return undefined;
          return { adminUsers: [uid] };
        });

      await expect(service.create(requestContext, studyEntity)).resolves.toStrictEqual({
        ...studyEntity,
        status: 'reachable',
        permissions: { ...getEmptyStudyPermissions(), adminUsers: [uid] },
      });
    });
  });

  describe('createPresignedPostRequests', () => {
    it('should fail when the researcher is tries to upload files', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const filenames = [];
      const encrypt = true;
      const multiPart = true;
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      service._settings = {
        getBoolean: settingName => {
          if (settingName === 'disableStudyUploadByResearcher') {
            return true;
          }
          return undefined;
        },
      };
      // OPERATE
      await expect(
        service.createPresignedPostRequests(requestContext, 'study-2', filenames, encrypt, multiPart),
      ).rejects.toThrow(
        // CHECK
        expect.objectContaining({ message: 'Only admin are authorized to upload files.' }),
      );
    });

    it('should pass when the researcher is tries to upload files', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const filenames = [];
      const encrypt = true;
      const multiPart = true;
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const studyId = 'study-2';
      service._settings = {
        getBoolean: settingName => {
          if (settingName === 'disableStudyUploadByResearcher') {
            return false;
          }
          return undefined;
        },
      };
      // OPERATE
      await expect(
        service.createPresignedPostRequests(requestContext, studyId, filenames, encrypt, multiPart),
      ).rejects.toThrow(
        // CHECK
        // eslint-disable-next-line
        expect.objectContaining({ message: `Study with id \"study-2\" does not exist` }),
      );
    });
  });
});
