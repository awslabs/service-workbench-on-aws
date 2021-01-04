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
const _ = require('lodash');
// Mocked services
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/helpers/utils');
jest.mock('../application-role-service');

const Utils = require('@aws-ee/base-services/lib/helpers/utils');
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
  appRoleArn = 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
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
  arn = 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
  accountId = '1122334455',
  mainRegion = 'us-east-1',
  awsPartition = 'aws',
  bucket = 'bucket-1',
  bucketRegion = 'us-east-1',
  status = 'pending',
  name = 'swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
  qualifier = 'swb-IhsKhN8GsLneiis11ujlb8',
  boundaryPolicyArn = 'arn:aws:iam::123456789012:policy/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
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
  let iamClient;

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
    iamClient = {
      deleteRole: jest.fn(),
      deleteRolePolicy: jest.fn(),
      createRole: jest.fn(),
      putRolePolicy: jest.fn(),
    };
  });

  describe('when allocating a role', () => {
    it('skip if study bucket access is not roles', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const study = { bucketAccess: 'something else' };
      const env = {};
      const accountId = '1234456789012';

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

    it('when allocating role check updateAssumeRolePolicy idempotency', async () => {
      // BUILD
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
        trust: ['3333333'],
      };
      const initialValue = _.cloneDeep(fsRoleEntity);
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
      service.find = jest.fn().mockResolvedValue(fsRoleEntity);

      // EXECUTE

      // Attempt #1 (Unsuccessful)
      const error = new Error('Some error during updating IAM role policy');
      error.boom = true;
      error.safe = true;
      service.updateAssumeRolePolicy = jest.fn(async () => {
        return Promise.reject(error);
      });
      await expect(service.allocateRole(requestContext, study, env, memberAcct)).rejects.toThrow(error);

      // CHECK (Attempt #1)
      expect(service.provisionRole).not.toHaveBeenCalled();
      expect(usageService.addUsage).not.toHaveBeenCalled();
      expect(service.saveEntity).not.toHaveBeenCalled();

      // Attempt #2 (Successful)
      service.updateAssumeRolePolicy = jest.fn();
      service.find = jest.fn().mockResolvedValue(initialValue);
      await service.allocateRole(requestContext, study, env, memberAcct);

      // CHECK (Attempt #2)
      expect(service.provisionRole).not.toHaveBeenCalled();
      expect(usageService.addUsage).toHaveBeenCalledTimes(1);
      expect(service.saveEntity).toHaveBeenCalledTimes(1);
    });

    it('when allocating role check provisionRole idempotency', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const study = createStudy();
      const appRole = createAppRole();
      const env = {};
      const memberAcct = '1234456789012';

      appRoleService.mustFind = jest.fn((_rq, { arn }) => {
        if (arn === appRole.arn) return Promise.resolve(appRole);
        return Promise.resolve();
      });
      usageService.getResourceUsage = jest.fn((_rq, { setName }) => {
        return Promise.resolve({ [setName]: [] });
      });
      usageService.addUsage = jest.fn();
      service.updateAssumeRolePolicy = jest.fn();
      service.saveEntity = jest.fn((_rq, entity) => {
        return Promise.resolve(entity);
      });

      // EXECUTE

      // Attempt #1 (Unsuccessful)
      const error = new Error('Some error during provisioning IAM role');
      error.boom = true;
      error.safe = true;
      service.provisionRole = jest.fn(async () => {
        return Promise.reject(error);
      });
      await expect(service.allocateRole(requestContext, study, env, memberAcct)).rejects.toThrow(error);

      // CHECK (Attempt #1)
      expect(usageService.addUsage).not.toHaveBeenCalled();
      expect(service.saveEntity).not.toHaveBeenCalled();

      // Attempt #2 (Successful)
      service.provisionRole = jest.fn();
      await service.allocateRole(requestContext, study, env, memberAcct);

      // CHECK (Attempt #2)
      expect(usageService.addUsage).toHaveBeenCalledTimes(2);
      expect(service.saveEntity).toHaveBeenCalledTimes(1);
    });

    it('ensures no errors are thrown when role and policy are created', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      iamClient.createRole = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      iamClient.putRolePolicy = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);
      const retryMock = jest.spyOn(Utils, 'retry');
      retryMock.mockImplementation(async fn => {
        const result = await fn();
        return result;
      });

      // EXECUTE & CHECK no exceptions thrown
      await service.provisionRole(fsRoleEntity);
      expect(iamClient.createRole).toHaveBeenCalledTimes(1);
      expect(iamClient.putRolePolicy).toHaveBeenCalledTimes(1);
    });

    it('ensures no errors are thrown when policy entity already exists', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      const error = new Error('EntityAlreadyExists');
      error.code = 'EntityAlreadyExists';
      iamClient.createRole = jest.fn().mockImplementation(() => {
        throw error;
      });
      iamClient.putRolePolicy = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);

      // EXECUTE & CHECK no exceptions thrown
      await service.provisionRole(fsRoleEntity);
      expect(iamClient.createRole).toHaveBeenCalledTimes(1);
      expect(iamClient.putRolePolicy).not.toHaveBeenCalled();
    });

    it('ensures no errors are thrown when role entity already exists', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      const error = new Error('EntityAlreadyExists');
      error.code = 'EntityAlreadyExists';
      iamClient.createRole = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      iamClient.putRolePolicy = jest.fn().mockImplementation(() => {
        throw error;
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);
      const retryMock = jest.spyOn(Utils, 'retry');
      retryMock.mockImplementation(async fn => {
        const result = await fn();
        return result;
      });

      // EXECUTE & CHECK no exceptions thrown
      await service.provisionRole(fsRoleEntity);
      expect(iamClient.putRolePolicy).toHaveBeenCalledTimes(1);
      expect(iamClient.createRole).toHaveBeenCalledTimes(1);
    });

    it('ensures errors are thrown when unknown exception encountered', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      const error = new Error('UnknownException');
      error.code = 'UnknownException';
      iamClient.createRole = jest.fn().mockImplementation(() => {
        throw error;
      });
      iamClient.putRolePolicy = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);
      const retryMock = jest.spyOn(Utils, 'retry');
      retryMock.mockImplementation(async fn => {
        const result = await fn();
        return result;
      });

      // EXECUTE & CHECK no exceptions thrown
      await expect(service.provisionRole(fsRoleEntity)).rejects.toThrow(
        `There was a problem provisioning the role. Error: Error: ${error.code}`,
      );
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

    it('Role delete retry after unsuccessful delete attempt - deprovisionRole idempotency', async () => {
      // BUILD
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

      service.saveEntity = jest.fn((_rq, entity) => {
        return Promise.resolve(entity);
      });
      service.find = jest.fn().mockResolvedValue(fsRoleEntity);
      const deleteObj = {
        key: () => {
          return deleteObj;
        },
        delete: jest.fn(),
      };
      service._deleter = jest.fn().mockReturnValue(deleteObj);

      // EXECUTE

      // Attempt #1 (Unsuccessful)
      const error = new Error('Some error during deleting IAM role');
      error.boom = true;
      error.safe = true;
      service.deprovisionRole = jest.fn(async () => {
        return Promise.reject(error);
      });
      await expect(service.deallocateRole(requestContext, arn, study, env, memberAcct)).rejects.toThrow(error);

      // CHECK (Attempt #1)
      expect(usageService.removeUsage).toHaveBeenCalledTimes(2);
      expect(deleteObj.delete).not.toHaveBeenCalled();
      expect(service.saveEntity).toHaveBeenCalledTimes(2);

      // Attempt #2 (Successful)
      service.deprovisionRole = jest.fn();
      await expect(service.find()).resolves.toStrictEqual({ arn: 'fs-role-arn', studies: {}, trust: [] }); // DB has updated entity during previous attempt
      await service.deallocateRole(requestContext, arn, study, env, memberAcct);

      // CHECK (Attempt #2)
      expect(usageService.removeUsage).toHaveBeenCalledTimes(4);
      expect(service.saveEntity).toHaveBeenCalledTimes(4);
      expect(deleteObj.delete).toHaveBeenCalledTimes(1);
    });

    it('Role policy retry after unsuccessful update attempt - updateAssumeRolePolicy idempotency', async () => {
      // BUILD
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
        trust: [memberAcct, '3333333'],
      };
      service.deprovisionRole = jest.fn();
      usageService.removeUsage = jest.fn(_rq => {
        return Promise.resolve({ items: [], removed: true });
      });

      service.saveEntity = jest.fn((_rq, entity) => {
        return Promise.resolve(entity);
      });
      service.find = jest.fn().mockResolvedValue(fsRoleEntity);
      const deleteObj = {
        key: () => {
          return deleteObj;
        },
        delete: jest.fn(),
      };
      service._deleter = jest.fn().mockReturnValue(deleteObj);

      // EXECUTE

      // Attempt #1 (Unsuccessful)
      const error = new Error('Some error during updating IAM role policy');
      error.boom = true;
      error.safe = true;
      service.updateAssumeRolePolicy = jest.fn(async () => {
        return Promise.reject(error);
      });
      await expect(service.deallocateRole(requestContext, arn, study, env, memberAcct)).rejects.toThrow(error);

      // CHECK (Attempt #1)
      expect(usageService.removeUsage).toHaveBeenCalledTimes(1);
      expect(deleteObj.delete).not.toHaveBeenCalled();
      expect(service.saveEntity).not.toHaveBeenCalled();

      // Attempt #2 (Successful)
      service.updateAssumeRolePolicy = jest.fn();
      await service.deallocateRole(requestContext, arn, study, env, memberAcct);

      // CHECK (Attempt #2)
      expect(usageService.removeUsage).toHaveBeenCalledTimes(2);
      expect(deleteObj.delete).not.toHaveBeenCalled(); // There are still other accounts linked
      expect(service.saveEntity).toHaveBeenCalledTimes(1);
    });

    it('Delete role policy with missing study and account trust', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const study = createStudy();
      const env = { id: 'env-1' };
      const memberAcct = '1234456789012';
      const arn = 'fs-role-arn';
      const fsRoleEntity = {
        arn,
        studies: {},
        trust: [],
      };
      service.updateAssumeRolePolicy = jest.fn();
      service.deprovisionRole = jest.fn();
      usageService.removeUsage = jest.fn(_rq => {
        return Promise.resolve({ items: [], removed: true });
      });

      service.saveEntity = jest.fn((_rq, entity) => {
        return Promise.resolve(entity);
      });
      service.find = jest.fn().mockResolvedValue(fsRoleEntity);
      const deleteObj = {
        key: () => {
          return deleteObj;
        },
        delete: jest.fn(),
      };
      service._deleter = jest.fn().mockReturnValue(deleteObj);

      // EXECUTE
      // Attempt
      await service.deallocateRole(requestContext, arn, study, env, memberAcct);

      // CHECK
      expect(deleteObj.delete).toHaveBeenCalledTimes(1);
      expect(service.deprovisionRole).toHaveBeenCalledTimes(1);
    });

    it('ensures successful deprovisionRole response when no errors are thrown', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      iamClient.deleteRole = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      iamClient.deleteRolePolicy = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);

      // EXECUTE & CHECK no exceptions thrown
      await service.deprovisionRole(fsRoleEntity);
    });

    it('ensures no errors are thrown when no policy entity found', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      const error = new Error('NoSuchEntity');
      error.code = 'NoSuchEntity';
      iamClient.deleteRolePolicy = jest.fn().mockImplementation(() => {
        throw error;
      });
      iamClient.deleteRole = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);

      // EXECUTE & CHECK no exceptions thrown
      await service.deprovisionRole(fsRoleEntity);
      expect(iamClient.deleteRolePolicy).toHaveBeenCalledTimes(1);
      expect(iamClient.deleteRole).not.toHaveBeenCalled();
    });

    it('ensures no errors are thrown when no role entity found', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      const error = new Error('NoSuchEntity');
      error.code = 'NoSuchEntity';
      iamClient.deleteRole = jest.fn().mockImplementation(() => {
        throw error;
      });
      iamClient.deleteRolePolicy = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);
      const retryMock = jest.spyOn(Utils, 'retry');
      retryMock.mockImplementation(async fn => {
        const result = await fn();
        return result;
      });

      // EXECUTE & CHECK no exceptions thrown
      await service.deprovisionRole(fsRoleEntity);
      expect(iamClient.deleteRolePolicy).toHaveBeenCalledTimes(1);
      expect(iamClient.deleteRole).toHaveBeenCalledTimes(1);
    });

    it('ensures errors are thrown when unknown exception encountered', async () => {
      // BUILD
      const fsRoleEntity = { name: 'sampleRoleName', appRoleArn: 'sampleRoleArn' };
      const error = new Error('UnknownException');
      error.code = 'UnknownException';
      iamClient.deleteRole = jest.fn().mockImplementation(() => {
        throw error;
      });
      iamClient.deleteRolePolicy = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return Promise.resolve();
          },
        };
      });
      service.getIamClient = jest.fn().mockResolvedValue(iamClient);
      const retryMock = jest.spyOn(Utils, 'retry');
      retryMock.mockImplementation(async fn => {
        const result = await fn();
        return result;
      });

      // EXECUTE & CHECK no exceptions thrown
      await expect(service.deprovisionRole(fsRoleEntity)).rejects.toThrow(
        `There was a problem deprovisioning the role. Error: Error: ${error.code}`,
      );
    });
  });
});
