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

// Mocked services
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('../application-role-service');

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const ApplicationRoleService = require('../application-role-service');
const ResourceUsageService = require('../../../../usage/resource-usage-service');
const FilesystemRoleService = require('../filesystem-role-service');

const createStudy = ({
  id = 'study-1',
  category = 'Organization',
  accountId = '1122334455',
  awsPartition = 'aws',
  bucketAccess = 'roles',
  bucket = 'bucket-1',
  qualifier = 'swb-IhsKhN8GsLneiis11ujlb8',
  appRoleArn = 'arn:aws:iam::684277579687:role/swb-IhsKhN8GsLneiis11ujlb8-app-1607537845811',
  accessType = 'readwrite',
  envPermission = { read: true, write: true },
  folder = '/',
  kmsScope = 'none',
} = {}) => ({
  id,
  category,
  accountId,
  awsPartition,
  bucketAccess,
  bucket,
  qualifier,
  appRoleArn,
  accessType,
  envPermission,
  folder,
  kmsScope,
});

const createAppRole = ({
  arn = 'arn:aws:iam::684277579687:role/swb-IhsKhN8GsLneiis11ujlb8-app-1607537845811',
  accountId = '1122334455',
  mainRegion = 'us-east-1',
  awsPartition = 'aws',
  bucket = 'bucket-1',
  bucketRegion = 'us-east-1',
  status = 'pending',
  name = 'swb-IhsKhN8GsLneiis11ujlb8-app-1607537845811',
  qualifier = 'swb-IhsKhN8GsLneiis11ujlb8',
  boundaryPolicyArn = 'arn:aws:iam::684277579687:policy/swb-IhsKhN8GsLneiis11ujlb8-app-1607537845811',
  studies = {
    'study-1': {
      accessType: 'readonly',
      kmsScope: 'none',
      folder: '/',
    },
  },
} = {}) => ({
  accountId,
  arn,
  name,
  mainRegion,
  awsPartition,
  bucket,
  bucketRegion,
  status,
  qualifier,
  boundaryPolicyArn,
  studies,
});

const createAdminContext = ({ uid = 'uid-admin' } = {}) => ({
  principalIdentifier: { uid },
  principal: { isAdmin: true, userRole: 'admin', status: 'active' },
});

describe('DataSourceBucketService', () => {
  let container;
  let service;
  let appRoleService;
  let usageService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();

    container.register('dbService', new DbService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsService());
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('roles-only/applicationRoleService', new ApplicationRoleService());
    container.register('resourceUsageService', new ResourceUsageService());
    container.register('roles-only/filesystemRoleService', new FilesystemRoleService());
    await container.initServices();

    service = await container.find('roles-only/filesystemRoleService');
    appRoleService = await container.find('roles-only/applicationRoleService');
    usageService = await container.find('resourceUsageService');
  });

  describe('when allocating a role', () => {
    it('skip if study bucket access is not roles', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const study = { bucketAccess: 'something else' };
      const env = {};
      const accountId = '1234456789012';

      usageService.getResourceUsage = jest.fn(() => {
        throw new Error('I got here');
      });
      await expect(service.allocateRole(requestContext, study, env, accountId)).resolves.toBeUndefined();
    });

    it('only admins are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const study = { bucketAccess: 'roles' };
      const env = {};
      const accountId = '1234456789012';

      await expect(service.allocateRole(requestContext, study, env, accountId)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('create a new role if one is not found', async () => {
      const requestContext = createAdminContext();
      const study = createStudy();
      const appRole = createAppRole();
      const env = {};
      const memberAcct = '1234456789012';
      let fsRoleEntity = {};

      appRoleService.mustFind = jest.fn((_rq, { arn }) => {
        if (arn === appRole.arn) return Promise.resolve(appRole);
        return Promise.resolve();
      });

      usageService.getResourceUsage = jest.fn((_rq, { setName }) => {
        return Promise.resolve({ [setName]: [] });
      });

      service.provisionRole = jest.fn();
      service.saveEntity = jest.fn((_rq, entity) => {
        fsRoleEntity = entity;
        return Promise.resolve(entity);
      });
      usageService.addUsage = jest.fn();

      await expect(service.allocateRole(requestContext, study, env, memberAcct)).resolves.toStrictEqual(
        expect.objectContaining({
          studies: {
            'study-1': {
              accessType: 'readwrite',
              envPermission: { read: true, write: true },
              folder: '/',
              kmsArn: undefined,
              kmsScope: 'none',
            },
          },
          trust: [memberAcct],
        }),
      );
      expect(service.provisionRole).toHaveBeenCalledWith(expect.objectContaining(fsRoleEntity));
    });

    it('return a role if there was a match', async () => {
      const requestContext = createAdminContext();
      const study = createStudy();
      const appRole = createAppRole();
      const env = {};
      const memberAcct = '1234456789012';
      const fsRoleEntity = {
        arn: 'fs-role-arn',
        studies: {
          'study-1': {
            accessType: 'readwrite',
            envPermission: { read: true, write: true },
            folder: '/',
            kmsArn: undefined,
            kmsScope: 'none',
          },
        },
        trust: [memberAcct],
      };

      appRoleService.mustFind = jest.fn((_rq, { arn }) => {
        if (arn === appRole.arn) return Promise.resolve(appRole);
        return Promise.resolve();
      });

      usageService.getResourceUsage = jest.fn((_rq, { setName }) => {
        return Promise.resolve({ [setName]: [fsRoleEntity.arn] });
      });
      usageService.addUsage = jest.fn();

      service.provisionRole = jest.fn();
      service.saveEntity = jest.fn((_rq, entity) => {
        return Promise.resolve(entity);
      });
      service.find = jest.fn((_rq, { arn }) => {
        if (arn === fsRoleEntity.arn) return Promise.resolve(fsRoleEntity);
        return Promise.resolve();
      });

      await expect(service.allocateRole(requestContext, study, env, memberAcct)).resolves.toStrictEqual(
        expect.objectContaining(fsRoleEntity),
      );
      expect(service.provisionRole).not.toHaveBeenCalled();
    });
  });

  describe('when de-allocating a role', () => {
    it('skip if study bucket access is not roles', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const study = { bucketAccess: 'something else' };
      const env = {};
      const accountId = '1234456789012';

      usageService.getResourceUsage = jest.fn(() => {
        throw new Error('I got here');
      });
      await expect(service.deallocateRole(requestContext, study, env, accountId)).resolves.toBeUndefined();
    });

    it('only admins are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const study = createStudy();
      const env = {};
      const accountId = '1234456789012';

      await expect(service.deallocateRole(requestContext, 'fs-role-arn', study, env, accountId)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('delete role if orphan', async () => {
      const requestContext = createAdminContext();
      const study = createStudy();
      const env = { id: 'env-1' };
      const memberAcct = '1234456789012';
      const arn = 'fs-role-arn';
      const fsRoleEntity = {
        arn,
        studies: {
          'study-1': {
            accessType: 'readwrite',
            envPermission: { read: true, write: true },
            folder: '/',
            kmsArn: undefined,
            kmsScope: 'none',
          },
        },
        trust: [memberAcct],
      };

      usageService.removeUsage = jest.fn(_rq => {
        return Promise.resolve({ items: [], removed: true });
      });

      service.provisionRole = jest.fn();
      service.deprovisionRole = jest.fn();
      service.saveEntity = jest.fn((_rq, entity) => {
        return Promise.resolve(entity);
      });
      // eslint-disable-next-line no-shadow
      service.find = jest.fn((_rq, { arn }) => {
        if (arn === fsRoleEntity.arn) return Promise.resolve(fsRoleEntity);
        return Promise.resolve();
      });

      const deleteObj = {
        key: () => {
          return deleteObj;
        },
        delete: jest.fn(),
      };
      service._deleter = jest.fn().mockReturnValue(deleteObj);

      await expect(service.deallocateRole(requestContext, arn, study, env, memberAcct)).resolves.toBeUndefined();
      expect(service.provisionRole).not.toHaveBeenCalled();
      expect(service.deprovisionRole).toHaveBeenCalled();
      expect(deleteObj.delete).toHaveBeenCalled();
    });

    it('do not delete role if being used by other accounts', async () => {
      const requestContext = createAdminContext();
      const study = createStudy();
      const env = { id: 'env-1' };
      const memberAcct = '1234456789012';
      const arn = 'fs-role-arn';
      const fsRoleEntity = {
        arn,
        studies: {
          'study-1': {
            accessType: 'readwrite',
            envPermission: { read: true, write: true },
            folder: '/',
            kmsArn: undefined,
            kmsScope: 'none',
          },
        },
        trust: [memberAcct],
      };

      usageService.removeUsage = jest.fn(_rq => {
        return Promise.resolve({ items: ['333333333'], removed: true });
      });

      service.provisionRole = jest.fn();
      service.deprovisionRole = jest.fn();
      service.saveEntity = jest.fn((_rq, entity) => {
        return Promise.resolve(entity);
      });
      // eslint-disable-next-line no-shadow
      service.find = jest.fn((_rq, { arn }) => {
        if (arn === fsRoleEntity.arn) return Promise.resolve(fsRoleEntity);
        return Promise.resolve();
      });
      const deleteObj = {
        key: () => {
          return deleteObj;
        },
        delete: jest.fn(),
      };
      service._deleter = jest.fn().mockReturnValue(deleteObj);

      await expect(service.deallocateRole(requestContext, arn, study, env, memberAcct)).resolves.toBeUndefined();
      expect(service.provisionRole).not.toHaveBeenCalled();
      expect(service.deprovisionRole).not.toHaveBeenCalled();
      expect(deleteObj.delete).not.toHaveBeenCalled();
    });
  });
});
