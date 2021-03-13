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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

// Mocked services
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('../../environment/service-catalog/environment-sc-service');
jest.mock('../../user/user-service');
jest.mock('../../study/study-service');
jest.mock('../../study/study-permission-service');

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const UserService = require('../../user/user-service');
const EnvironmentScService = require('../../environment/service-catalog/environment-sc-service');
const StudyService = require('../study-service');
const StudyPermissionService = require('../study-permission-service');
const StudyOperationService = require('../study-operation-service');

const createResearcherContext = ({ uid = 'uid-researcher-1' } = {}) => ({
  principalIdentifier: { uid },
  principal: { userRole: 'researcher', status: 'active' },
});

describe('StudyOperationService', () => {
  let service;
  let lockService;
  let envService;
  let studyService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DbService());
    container.register('lockService', new LockService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsService());
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('userService', new UserService());
    container.register('environmentScService', new EnvironmentScService());
    container.register('studyService', new StudyService());
    container.register('studyPermissionService', new StudyPermissionService());
    container.register('studyOperationService', new StudyOperationService());
    await container.initServices();

    service = await container.find('studyOperationService');
    lockService = await container.find('lockService');
    envService = await container.find('environmentScService');
    studyService = await container.find('studyService');
  });

  describe('update study permissions', () => {
    it('throws if workspaces to update are more than 100', async () => {
      const requestContext = createResearcherContext();
      const studyId = '123';
      const updateRequest = { usersToAdd: [{ uid: '1', permissionLevel: 'readonly' }] };

      lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
        return fn();
      });

      envService.getMemberAccount = jest.fn(() => {
        return { accountId: '00001' };
      });

      // We first test that it won't throw if we have 100 workspaces
      envService.getActiveEnvsForUser = jest.fn(() => {
        // We return a 100 environments
        return _.times(100, () => ({ studyIds: [studyId] }));
      });

      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).resolves.toBeUndefined();

      // Now, we test if it throws if we have more than 100 workspaces
      envService.getActiveEnvsForUser = jest.fn(() => {
        // We return more than 100 environments
        return _.times(101, () => ({ studyIds: [studyId] }));
      });

      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('calls deallocateResources for all impacted environments', async () => {
      const requestContext = createResearcherContext();
      const systemContext = getSystemRequestContext();
      const studyId = '123';
      const studyIds = [studyId];
      const updateRequest = {
        usersToAdd: [{ uid: '1', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: '2', permissionLevel: 'readwrite' }],
      };

      lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
        return fn();
      });

      envService.getMemberAccount = jest.fn(() => {
        return { accountId: '00001' };
      });

      envService.find = jest.fn((_rq, { id }) => {
        return { id, studyIds };
      });

      envService.getActiveEnvsForUser = jest.fn(() => {
        // We return 2 environments
        return [
          { id: 'env-1', studyIds },
          { id: 'env-2', studyIds },
        ];
      });

      service.deallocateResources = jest.fn();

      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).resolves.toBeUndefined();
      expect(envService.find).toHaveBeenNthCalledWith(1, expect.objectContaining(systemContext), {
        id: 'env-1',
        fetchCidr: false,
      });
      expect(envService.find).toHaveBeenNthCalledWith(2, expect.objectContaining(systemContext), {
        id: 'env-2',
        fetchCidr: false,
      });
      expect(service.deallocateResources).toHaveBeenCalledTimes(4); // 2 users with 2 env
    });

    it('calls allocateResources for all impacted environments if user is in usersToAdd', async () => {
      const requestContext = createResearcherContext();
      const systemContext = getSystemRequestContext();
      const studyId = '123';
      const studyIds = [studyId];
      const updateRequest = {
        usersToAdd: [{ uid: 'uid-1', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'uid-2', permissionLevel: 'readwrite' }],
      };
      const study = {
        id: studyId,
        permissions: {
          readwriteUsers: ['uid-2'],
        },
      };

      lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
        return fn();
      });

      envService.getMemberAccount = jest.fn(() => {
        return { accountId: '00001' };
      });

      envService.find = jest.fn((_rq, { id }) => {
        return { id, studyIds };
      });

      envService.getActiveEnvsForUser = jest.fn(uid => {
        if (uid !== 'uid-2') return [];
        return [
          { id: 'env-1', studyIds, createdBy: 'uid-2' },
          { id: 'env-2', studyIds, createdBy: 'uid-2' },
        ];
      });

      service.allocateResources = jest.fn();
      studyService.updatePermissions = jest.fn(() => study);

      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).resolves.toStrictEqual(study);
      expect(envService.find).toHaveBeenNthCalledWith(1, expect.objectContaining(systemContext), {
        id: 'env-1',
        fetchCidr: false,
      });
      expect(envService.find).toHaveBeenNthCalledWith(2, expect.objectContaining(systemContext), {
        id: 'env-2',
        fetchCidr: false,
      });
      expect(service.allocateResources).toHaveBeenCalledTimes(2); // We only have 1 user in the usersToAdd with 2 envs.
    });

    it('calls updateRolePolicy', async () => {
      const requestContext = createResearcherContext();
      const systemContext = getSystemRequestContext();
      const studyId = '123';
      const studyIds = [studyId];
      const updateRequest = {
        usersToAdd: [{ uid: 'uid-1', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'uid-2', permissionLevel: 'readwrite' }],
      };
      const study = {
        id: studyId,
        permissions: {
          readwriteUsers: ['uid-2'],
        },
      };
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:GetObjectTagging',
              's3:GetObjectTorrent',
              's3:GetObjectVersion',
              's3:GetObjectVersionTagging',
              's3:GetObjectVersionTorrent',
            ],
            Resource: ['arn:aws:s3:::bucket/study/*'],
          },
        ],
      };

      lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
        return fn();
      });

      envService.getMemberAccount = jest.fn(() => {
        return { accountId: '00001' };
      });

      envService.find = jest.fn((_rq, { id }) => {
        return { id, studyIds };
      });

      envService.getActiveEnvsForUser = jest.fn(uid => {
        if (uid !== 'uid-2') return [];
        return [{ id: 'env-1', studyIds, createdBy: 'uid-2' }];
      });

      service.allocateResources = jest.fn();
      studyService.updatePermissions = jest.fn(() => study);
      service.generateEnvRolePolicy = jest.fn().mockResolvedValue(policy);
      envService.updateRolePolicy = jest.fn();

      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).resolves.toStrictEqual(study);
      expect(envService.find).toHaveBeenNthCalledWith(1, expect.objectContaining(systemContext), {
        id: 'env-1',
        fetchCidr: false,
      });
      expect(service.allocateResources).toHaveBeenCalledTimes(1);
      expect(envService.updateRolePolicy).toHaveBeenCalledWith(requestContext, { id: 'env-1', studyIds }, policy);
    });

    it('calls allocateResources even if one env failed', async () => {
      const requestContext = createResearcherContext();
      const systemContext = getSystemRequestContext();
      const studyId = '123';
      const studyIds = [studyId];
      const updateRequest = {
        usersToAdd: [{ uid: 'uid-1', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'uid-2', permissionLevel: 'readwrite' }],
      };
      const study = {
        id: studyId,
        permissions: {
          readwriteUsers: ['uid-2'],
        },
      };

      lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
        return fn();
      });

      envService.getMemberAccount = jest.fn(() => {
        return { accountId: '00001' };
      });

      envService.find = jest.fn((_rq, { id }) => {
        if (id === 'env-1') throw new Error(`Can not connect to the database to get ${id}`);
        return { id, studyIds };
      });

      envService.getActiveEnvsForUser = jest.fn(uid => {
        if (uid !== 'uid-2') return [];
        return [
          { id: 'env-1', studyIds, createdBy: 'uid-2' },
          { id: 'env-2', studyIds, createdBy: 'uid-2' },
        ];
      });

      service.allocateResources = jest.fn();
      studyService.updatePermissions = jest.fn(() => study);

      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).rejects.toThrow(
        expect.objectContaining({ boom: true, safe: true, code: 'internalError' }),
      );
      expect(envService.find).toHaveBeenNthCalledWith(1, expect.objectContaining(systemContext), {
        id: 'env-1',
        fetchCidr: false,
      });
      expect(envService.find).toHaveBeenNthCalledWith(2, expect.objectContaining(systemContext), {
        id: 'env-2',
        fetchCidr: false,
      });
      // We only have 1 user in the usersToAdd with 2 envs, one of them failed, so the number of allocation should 1
      expect(service.allocateResources).toHaveBeenCalledTimes(1);
    });

    it('calls deallocateResources even if one env failed ', async () => {
      const requestContext = createResearcherContext();
      const systemContext = getSystemRequestContext();
      const studyId = '123';
      const studyIds = [studyId];
      const updateRequest = {
        usersToAdd: [{ uid: '1', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: '2', permissionLevel: 'readwrite' }],
      };

      lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
        return fn();
      });

      envService.getMemberAccount = jest.fn(() => {
        return { accountId: '00001' };
      });

      envService.find = jest.fn((_rq, { id }) => {
        if (id === 'env-1') throw new Error(`Can not connect to the database to get ${id}`);
        return { id, studyIds };
      });

      envService.getActiveEnvsForUser = jest.fn(() => {
        // We return 2 environments
        return [
          { id: 'env-1', studyIds },
          { id: 'env-2', studyIds },
        ];
      });

      service.deallocateResources = jest.fn();

      await expect(service.updatePermissions(requestContext, studyId, updateRequest)).rejects.toThrow(
        expect.objectContaining({ boom: true, safe: true, code: 'internalError' }),
      );
      expect(envService.find).toHaveBeenNthCalledWith(1, expect.objectContaining(systemContext), {
        id: 'env-1',
        fetchCidr: false,
      });
      expect(envService.find).toHaveBeenNthCalledWith(2, expect.objectContaining(systemContext), {
        id: 'env-2',
        fetchCidr: false,
      });
      // without errors, there should be 4 deallocation because we have 2 user with 2 env each. But because we always
      // fail 'env-1' for both users, then the number of deallocation should be 2
      expect(service.deallocateResources).toHaveBeenCalledTimes(2);
    });
  });
});
