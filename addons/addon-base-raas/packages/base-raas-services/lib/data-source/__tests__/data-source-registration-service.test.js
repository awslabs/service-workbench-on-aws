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
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/s3-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('../../user/user-service');
jest.mock('../../study/study-service');
jest.mock('../../study/study-permission-service');

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const S3Service = require('@aws-ee/base-services/lib/s3-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const UserService = require('../../user/user-service');
const StudyService = require('../../study/study-service');
const StudyPermissionService = require('../../study/study-permission-service');
const DataSourceAccountService = require('../data-source-account-service');
const DataSourceBucketService = require('../data-source-bucket-service');
const DataSourceRegistrationService = require('../data-source-registration-service');

describe('DataSourceBucketService', () => {
  let service;
  // let dbService;
  let accountService;
  let bucketService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DbService());
    container.register('lockService', new LockService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsService());
    container.register('aws', new Aws());
    container.register('s3Service', new S3Service());
    container.register('log', new Logger());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('userService', new UserService());
    container.register('studyService', new StudyService());
    container.register('studyPermissionService', new StudyPermissionService());
    container.register('dataSourceAccountService', new DataSourceAccountService());
    container.register('dataSourceBucketService', new DataSourceBucketService());
    container.register('dataSourceRegistrationService', new DataSourceRegistrationService());
    await container.initServices();

    service = await container.find('dataSourceRegistrationService');
    // dbService = await container.find('dbService');
    accountService = await container.find('dataSourceAccountService');
    bucketService = await container.find('dataSourceBucketService');
  });

  describe('register bucket', () => {
    it('only admins are allowed to register data source buckets', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const accountId = '123456789012';
      const rawData = { name: 'bucket-1', region: 'us-east-1', partition: 'aws' };

      await expect(service.registerBucket(requestContext, accountId, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('throws if account does not exist', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const accountId = '123456789012';
      const rawData = { name: 'bucket-1', region: 'us-east-1', partition: 'aws' };

      accountService.mustFind = jest.fn(async (context, { id }) => {
        if (id !== accountId) return Promise.resolve({ id });
        const error = new Error('');
        error.boom = true;
        error.code = 'notFound';
        error.safe = true;
        return Promise.reject(error);
      });

      await expect(service.registerBucket(requestContext, accountId, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'notFound', safe: true }),
      );
    });

    it('throws if bucket already registered', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const accountId = '123456789012';
      const rawData = { name: 'bucket-1', region: 'us-east-1', partition: 'aws' };

      accountService.mustFind = jest.fn(async (context, { id }) => {
        if (id === accountId) return Promise.resolve({ id });
        const error = new Error('Not found');
        error.boom = true;
        error.code = 'notFound';
        error.safe = true;
        return Promise.reject(error);
      });

      bucketService.register = jest.fn(async (context, accountEntity, rawBucketEntity) => {
        if (accountId === accountEntity.id && rawBucketEntity.name === rawData.name) {
          const error = new Error('Already registered');
          error.boom = true;
          error.code = 'alreadyExists';
          error.safe = true;
          return Promise.reject(error);
        }

        return Promise.resolve(rawBucketEntity);
      });

      await expect(service.registerBucket(requestContext, accountId, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'alreadyExists', safe: true }),
      );
    });
  });
});
