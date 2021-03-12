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

const DbService = require('@aws-ee/base-services/lib/db-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const ApplicationRoleService = require('../application-role-service');
const AppRoleMethods = require('../helpers/entities/application-role-methods');

const { CfnTemplate } = require('../../../../helpers/cfn-template');

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
  by = 'sampleUser',
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
  by,
  awsPartition,
  bucket,
  bucketRegion,
  status,
  qualifier,
  boundaryPolicyArn,
  studies,
});

describe('ApplicationRoleService', () => {
  let service;
  let dbService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DbService());
    container.register('roles-only/applicationRoleService', new ApplicationRoleService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('settings', new SettingsService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    await container.initServices();

    service = await container.find('roles-only/applicationRoleService');
    dbService = await container.find('dbService');

    // Skip authorization
    service.assertAuthorized = jest.fn();
  });

  describe('allocateRole', () => {
    it('ensures allocateRole does not create new appRole when a matching one exists', async () => {
      // BUILD
      const appRole = createAppRole();
      const requestContext = 'sampleRequestContext';
      const studyEntity = createStudy();
      const accountEntity = {};
      const bucketEntity = {};
      service.list = jest.fn().mockReturnValue([appRole]);
      service._updater = jest.fn();

      // EXECUTE & CHECK
      await expect(
        service.allocateRole(requestContext, accountEntity, bucketEntity, studyEntity),
      ).resolves.toStrictEqual(appRole);
      expect(service._updater).not.toHaveBeenCalled();
    });

    it('ensures allocateRole does not update anything when authorization fails', async () => {
      // BUILD
      const requestContext = {};
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });
      const studyEntity = createStudy();
      const accountEntity = {};
      const bucketEntity = {};
      service._updater = jest.fn();

      // EXECUTE & CHECK
      await expect(service.allocateRole(requestContext, accountEntity, bucketEntity, studyEntity)).rejects.toThrow(
        'User is not authorized',
      );
      expect(service._updater).not.toHaveBeenCalled();
    });

    it('ensures allocateRole does not create new appRole when a match exists with different study', async () => {
      // BUILD
      const appRole = createAppRole();
      const requestContext = 'sampleRequestContext';
      const studyEntity = createStudy({
        id: 'study-2', // Different study than the one in appRole
        category: 'Organization',
        accountId: '1122334455',
        awsPartition: 'aws',
        bucketAccess: 'roles',
        bucket: 'bucket-1',
        qualifier: 'swb-IhsKhN8GsLneiis11ujlb8',
        appRoleArn: 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
        accessType: 'readwrite',
        envPermission: { read: true, write: true },
        folder: '/',
        by: 'sampleUser',
        kmsScope: 'none',
      });
      const accountEntity = {};
      const bucketEntity = {};
      service.list = jest.fn().mockReturnValue([appRole]);
      dbService.table.update = jest.fn();
      const newAppRoleEntity = jest.spyOn(AppRoleMethods, 'newAppRoleEntity');

      // EXECUTE
      await service.allocateRole(requestContext, accountEntity, bucketEntity, studyEntity);

      // CHECK
      expect(newAppRoleEntity).not.toHaveBeenCalled();
      expect(dbService.table.update).toHaveBeenCalled();
    });

    it('ensures allocateRole creates new appRole when no appRoles are returned', async () => {
      // BUILD
      const requestContext = 'sampleRequestContext';
      const studyEntity = createStudy({
        id: 'study-2', // Different study than the one in appRole
        category: 'Organization',
        accountId: '1122334455',
        awsPartition: 'aws',
        bucketAccess: 'roles',
        bucket: 'bucket-1',
        qualifier: 'swb-IhsKhN8GsLneiis11ujlb8',
        appRoleArn: 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
        accessType: 'readwrite',
        envPermission: { read: true, write: true },
        folder: '/',
        by: 'sampleUser',
        kmsScope: 'none',
      });
      const accountEntity = {};
      const bucketEntity = {};
      service.list = jest.fn().mockReturnValue([]);
      dbService.table.update = jest.fn();
      const newAppRoleEntity = jest.spyOn(AppRoleMethods, 'newAppRoleEntity');

      // EXECUTE
      await service.allocateRole(requestContext, accountEntity, bucketEntity, studyEntity);

      // CHECK
      expect(newAppRoleEntity).not.toHaveBeenCalled();
      expect(dbService.table.update).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('ensures updateStatus does not fail when status and statusMsg are present', async () => {
      // BUILD
      const appRole = createAppRole();
      const requestContext = 'sampleRequestContext';
      const statusDetails = { status: 'reachable', statusMsg: '' };

      // EXECUTE & CHECK
      await service.updateStatus(requestContext, appRole, statusDetails);
    });

    it('ensures updateStatus does not fail when statusMsg is not present', async () => {
      // BUILD
      const appRole = createAppRole();
      const requestContext = 'sampleRequestContext';
      const statusDetails = { status: 'pending' };

      // EXECUTE & CHECK
      await service.updateStatus(requestContext, appRole, statusDetails);
    });

    it('ensures updateStatus fails when status is unknown', async () => {
      // BUILD
      const appRole = createAppRole();
      const requestContext = 'sampleRequestContext';
      const statusDetails = { status: 'unknownStatus' };

      // EXECUTE & CHECK
      await expect(service.updateStatus(requestContext, appRole, statusDetails)).rejects.toThrow(
        `A status of '${statusDetails.status}' is not allowed`,
      );
    });

    it('ensures updateStatus does not update anything when authorization fails', async () => {
      // BUILD
      const requestContext = {};
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });
      const appRole = createAppRole();
      const statusDetails = { status: 'unknownStatus' };
      service._updater = jest.fn();

      // EXECUTE & CHECK
      await expect(service.updateStatus(requestContext, appRole, statusDetails)).rejects.toThrow(
        'User is not authorized',
      );
      expect(service._updater).not.toHaveBeenCalled();
    });
  });

  describe('mustFind', () => {
    it('ensures mustFind fails when app role is not found', async () => {
      // BUILD
      const requestContext = 'sampleRequestContext';
      service.find = jest.fn();

      // EXECUTE & CHECK
      await expect(service.mustFind(requestContext, { arn: 'SampleARN' })).rejects.toThrow(
        `Application role with arn "SampleARN" does not exist`,
      );
    });

    it('ensures mustFind does not fail when app role is found', async () => {
      // BUILD
      const requestContext = 'sampleRequestContext';
      const appRole = createAppRole();
      service.find = jest.fn().mockResolvedValue(appRole);

      // EXECUTE & CHECK
      await expect(service.mustFind(requestContext, { arn: 'SampleARN' })).resolves.toStrictEqual(appRole);
    });

    it('ensures mustFind does not find anything when authorization fails', async () => {
      // BUILD
      const requestContext = {};
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });
      jest.spyOn(service, 'find');

      // EXECUTE & CHECK
      await expect(service.mustFind(requestContext, { arn: 'SampleARN' })).rejects.toThrow('User is not authorized');
    });
  });

  describe('list', () => {
    it('ensures list does not fail when app roles are found', async () => {
      // BUILD
      const requestContext = 'sampleRequestContext';
      const accountId = 'sampleAccountId';
      const appRole = createAppRole();
      dbService.table.query = jest.fn().mockResolvedValue([appRole]);

      // EXECUTE & CHECK
      await service.list(requestContext, accountId);
    });

    it('ensures list does not find anything when authorization fails', async () => {
      // BUILD
      const requestContext = {};
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // EXECUTE & CHECK
      await expect(service.list(requestContext, 'sampleAccountId')).rejects.toThrow('User is not authorized');
    });
  });

  describe('provideCfnResources', () => {
    it('ensures provideCfnResources does not fail', async () => {
      // BUILD
      const appRole = createAppRole();
      const requestContext = 'sampleRequestContext';
      const accountId = 'sampleAccountId';
      const cfnTemplate = new CfnTemplate({ accountId, region: 'us-east-1' });
      service.list = jest.fn().mockReturnValue([appRole]);

      // EXECUTE & CHECK
      await service.provideCfnResources(requestContext, cfnTemplate, accountId);
    });

    it('ensures provideCfnResources does not create anything when authorization fails', async () => {
      // BUILD
      const requestContext = {};
      const accountId = 'sampleAccountId';
      const cfnTemplate = new CfnTemplate({ accountId, region: 'us-east-1' });
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // EXECUTE & CHECK
      await expect(service.provideCfnResources(requestContext, cfnTemplate, accountId)).rejects.toThrow(
        'User is not authorized',
      );
    });
  });
});
