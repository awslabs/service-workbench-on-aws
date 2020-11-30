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
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/s3-service');
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
jest.mock('../../user/user-service');
jest.mock('../../project/project-service');

const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const S3ServiceMock = require('@aws-ee/base-services/lib/s3-service');
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
      const dataIpt = {
        id: '4 score and 7 years ago',
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

    it('should fail to update resource list of non-Open Data study', async () => {
      // BUILD
      const dataIpt = {
        id: 'newOpenStudy',
        category: 'Organization',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      service.audit = jest.fn();

      // OPERATE
      await expect(
        service.update(
          { principal: { userRole: 'researcher' }, principalIdentifier: { uid: 'someRandomUserUid' } },
          dataIpt,
        ),
      ).rejects.toThrow({
        message: 'Resources can only be updated for Open Data study category',
      });
    });

    it('should fail to update Open Data study by non-system user', async () => {
      // BUILD
      const dataIpt = {
        id: 'newOpenStudy',
        category: 'Open Data',
        resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
      };
      service.audit = jest.fn();

      // OPERATE
      await expect(
        service.update(
          { principal: { userRole: 'admin' }, principalIdentifier: { uid: 'someRandomUserUid' } },
          dataIpt,
        ),
      ).rejects.toThrow({
        message: 'Only the system can update Open Data studies.',
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
        expect(err.message).toEqual('Study with id "doppelganger" does not exist');
      }
    });
  });
});
