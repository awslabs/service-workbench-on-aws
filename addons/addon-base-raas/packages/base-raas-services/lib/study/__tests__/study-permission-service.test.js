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

// Mocked services
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
jest.mock('../../user/user-service');

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const UserService = require('../../user/user-service');
const StudyPermissionService = require('../study-permission-service');

const { getEmptyStudyPermissions } = require('../helpers/entities/study-permissions-methods');
const { getEmptyUserPermissions } = require('../helpers/entities/user-permissions-methods');

describe('StudyPermissionService', () => {
  let service;
  let dbService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DbService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsService());
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('lockService', new LockService());
    container.register('userService', new UserService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('studyPermissionService', new StudyPermissionService());
    await container.initServices();

    service = await container.find('studyPermissionService');
    dbService = await container.find('dbService');
  });

  describe('findStudyPermissions', () => {
    it('inactive users are not allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'admin', status: 'inactive' } };
      const studyEntity = { id: 'study-1' };

      await expect(service.findStudyPermissions(requestContext, studyEntity)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('admins are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'admin', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const dbPermissionsEntity = { id: `Study:${studyEntity.id}`, recordType: 'study', adminUsers: ['a'] };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ...getEmptyStudyPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id']),
      });
    });

    it('users who have admin access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [uid],
        readonlyUsers: ['1'],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ...getEmptyStudyPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id']),
      });
    });

    it('users who have read only access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [uid],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ...getEmptyStudyPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id']),
      });
    });

    it('users who have read write access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [],
        readwriteUsers: [uid],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ...getEmptyStudyPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id']),
      });
    });

    it('users who have write only access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [],
        readwriteUsers: [],
        writeonlyUsers: [uid],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual(
        _.omit(dbPermissionsEntity, ['recordType', 'id']),
      );
    });

    it('users who do not have access to the study are allowed if open data', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1', category: 'Open Data' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [],
        readwriteUsers: ['u-testing-1'],
        writeonlyUsers: ['u-testing-2'],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ..._.omit(dbPermissionsEntity, ['recordType', 'id']),
        readonlyUsers: [],
        readwriteUsers: [],
        writeonlyUsers: [],
      });
    });

    it('users who do not have access to the study are not allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [],
        readwriteUsers: [],
        writeonlyUsers: [],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('when accessType = readonly, no readwriteUsers nor writeonlyUsers are returned', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1', accessType: 'readonly' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [uid],
        readwriteUsers: [uid],
        writeonlyUsers: [uid],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ..._.omit(dbPermissionsEntity, ['recordType', 'id']),
        readwriteUsers: [],
        writeonlyUsers: [],
      });
    });

    it('when accessType = readwrite, readwrite and writeonlyUsers are returned', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1', accessType: 'readwrite' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [uid],
        readwriteUsers: [uid],
        writeonlyUsers: [uid],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ..._.omit(dbPermissionsEntity, ['recordType', 'id']),
      });
    });

    it('demote permission if user has readwrite access but accessType = readonly', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1', accessType: 'readonly' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [],
        readwriteUsers: [uid],
        writeonlyUsers: [],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).resolves.toStrictEqual({
        ..._.omit(dbPermissionsEntity, ['recordType', 'id', 'readwriteUsers']),
        readonlyUsers: [uid],
        readwriteUsers: [],
      });
    });

    it('throws if user has writeonly access but accessType = readonly', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1', accessType: 'readonly' };
      const dbPermissionsEntity = {
        id: `Study:${studyEntity.id}`,
        recordType: 'study',
        adminUsers: [],
        readonlyUsers: [],
        readwriteUsers: [],
        writeonlyUsers: [uid],
      };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey !== dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findStudyPermissions(requestContext, studyEntity)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });
  });

  describe('findUserPermissions', () => {
    it('inactive users are not allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'admin', status: 'inactive' } };

      await expect(service.findUserPermissions(requestContext, uid)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('admins are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid: 'u-3333' },
        principal: { userRole: 'admin', status: 'active', isAdmin: true },
      };
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

      await expect(service.findUserPermissions(requestContext, uid)).resolves.toStrictEqual({
        ...getEmptyUserPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id', 'uid']),
        uid,
      });
    });

    it('same user is allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active', isAdmin: false },
      };
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

      await expect(service.findUserPermissions(requestContext, uid)).resolves.toStrictEqual({
        ...getEmptyUserPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id', 'uid']),
        uid,
      });
    });

    it('throws if not admin and not the same user', async () => {
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid: 'u-nice' },
        principal: { userRole: 'researcher', status: 'active', isAdmin: false },
      };
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

      await expect(service.findUserPermissions(requestContext, uid)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden' }),
      );
    });

    it('returns an empty entity if no entry is found for the user', async () => {
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active', isAdmin: false },
      };
      const dbPermissionsEntity = { id: `User:${uid}`, uid, recordType: 'user' };

      let pKey;
      dbService.table.key = jest.fn(({ id }) => {
        pKey = id;
        return dbService.table;
      });

      dbService.table.get = jest.fn(() => {
        if (pKey === dbPermissionsEntity.id) return undefined;
        return dbPermissionsEntity;
      });

      await expect(service.findUserPermissions(requestContext, uid)).resolves.toStrictEqual({
        ...getEmptyUserPermissions(),
        ..._.omit(dbPermissionsEntity, ['recordType', 'id', 'uid']),
        uid,
      });
    });
  });

  describe('create permissions', () => {
    it('inactive users are not allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'admin', status: 'inactive' } };
      const studyEntity = { id: 'study-1' };

      await expect(service.create(requestContext, studyEntity)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('throws if study is open data', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'admin', status: 'active' } };
      const studyEntity = { id: 'study-1', category: 'Open Data' };
      const permissions = { adminUsers: [uid] };

      await expect(service.create(requestContext, studyEntity, permissions)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('throws if study permissions already exists', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const permissions = { adminUsers: [uid] };

      let key;
      dbService.table.key = jest.fn(({ id }) => {
        key = id;
        return dbService.table;
      });

      dbService.table.update = jest.fn(() => {
        const id = studyEntity.id;
        if (key === `Study:${id}`) {
          const error = new Error();
          // This the error that DynamoDB will throw
          error.code = 'ConditionalCheckFailedException';
          throw error;
        }
      });

      await expect(service.create(requestContext, studyEntity, permissions)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'alreadyExists', safe: true }),
      );
    });

    it('returns study permissions entity', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const studyEntity = { id: 'study-1' };
      const permissions = { adminUsers: [uid] };

      let key;
      dbService.table.key = jest.fn(({ id }) => {
        key = id;
        return dbService.table;
      });

      dbService.table.update = jest.fn(() => {
        const id = `Study:${studyEntity.id}`;
        if (key === id) {
          return { ...permissions, id, recordType: 'study' };
        }

        return undefined;
      });

      await expect(service.create(requestContext, studyEntity, permissions)).resolves.toStrictEqual({
        ...getEmptyStudyPermissions(),
        ...permissions,
      });
    });
  });

  describe('update permissions', () => {
    it('should fail since the given study id is invalid', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = {
        principalIdentifier: { uid },
        principal: { userRole: 'researcher', status: 'active' },
      };
      const studyEntity = {
        id: '<hack>',
      };
      const updateRequest = {};
      // OPERATE
      await expect(service.update(requestContext, studyEntity, updateRequest)).rejects.toThrow(
        // CHECK
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });
});
