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
const AwsMock = require('aws-sdk-mock');
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

// Mocked services
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('../../study/study-service');
jest.mock('../../study/study-permission-service');

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const DBService = require('@aws-ee/base-services/lib/db-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const StudyService = require('../../study/study-service');
const StudyPermissionService = require('../../study/study-permission-service');
const DataSourceAccountService = require('../data-source-account-service');

describe('DataSourceAccountService', () => {
  let service;
  let dbService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DBService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsService());
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('studyService', new StudyService());
    container.register('studyPermissionService', new StudyPermissionService());
    container.register('dataSourceAccountService', new DataSourceAccountService());
    await container.initServices();

    // Get instance of the service we are testing
    const aws = await container.find('aws');
    AwsMock.setSDKInstance(aws.sdk);
    service = await container.find('dataSourceAccountService');

    // Get the service we need to spy input on
    dbService = await container.find('dbService');
  });

  afterEach(() => {
    AwsMock.restore();
  });

  describe('create account', () => {
    it('should call DBService with correct input', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = { id, name: 'Computer Science Department Account', type: 'managed-nonmember' };

      await service.createAccount(requestContext, rawData);

      expect(dbService.table.key).toHaveBeenCalledWith({ pk: `ACT#${id}`, sk: `ACT#${id}` });
      expect(dbService.table.item).toHaveBeenCalledWith(
        expect.objectContaining({
          ..._.omit(rawData, ['id']),
          prefix: expect.stringContaining('swb-'),
          stackStatus: {
            checkStatus: 'pending',
            creationStatus: 'pending',
          },
          stack: expect.stringContaining('swb-'),
          updatedBy: uid,
          createdBy: uid,
          rev: 0,
        }),
      );
    });

    it('only admins are allowed to create data source accounts', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const rawData = { id: '123456789012', name: 'Computer Science Department Account', type: 'managed-nonmember' };

      await expect(service.createAccount(requestContext, rawData)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('throws if account already exists', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = { id: '123456789012', name: 'Computer Science Department Account', type: 'managed-nonmember' };
      let pKey;
      let sKey;
      dbService.table.key = jest.fn(({ pk, sk }) => {
        pKey = pk;
        sKey = sk;
        return dbService.table;
      });

      dbService.table.update = jest.fn(() => {
        const id = rawData.id;
        if (pKey === `ACT#${id}` && sKey === `ACT#${id}`) {
          const error = new Error();
          // This the error that DynamoDB will throw
          error.code = 'ConditionalCheckFailedException';
          throw error;
        }
      });

      await expect(service.createAccount(requestContext, rawData)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'alreadyExists', safe: true }),
      );
    });

    it('throws if account type is unmanaged', async () => {
      // unmanaged accounts are not supported in this release
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = { id: '123456789012', name: 'Computer Science Department Account', type: 'unmanaged' };

      await expect(service.createAccount(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'notSupported', safe: true }),
      );
    });
  });

  describe('update account', () => {
    it('should call DBService with correct input', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = { id, name: 'Computer Science Department Account', rev: 2 };

      await service.updateAccount(requestContext, rawData);

      expect(dbService.table.key).toHaveBeenCalledWith({ pk: `ACT#${id}`, sk: `ACT#${id}` });
      expect(dbService.table.rev).toHaveBeenCalledWith(2);
      expect(dbService.table.item).toHaveBeenCalledWith(
        expect.objectContaining({
          ..._.omit(rawData, ['id', 'rev']),
        }),
      );
    });

    it('only admins are allowed to update data source accounts', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const rawData = { id: '123456789012', name: 'Computer Science Department Account', rev: 2 };

      await expect(service.updateAccount(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('throws if account does not exist', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = { id: '123456789012', name: 'Computer Science Department Account', rev: 2 };
      let pKey;
      let sKey;
      dbService.table.key = jest.fn(({ pk, sk }) => {
        pKey = pk;
        sKey = sk;
        return dbService.table;
      });

      dbService.table.update = jest.fn(() => {
        const id = rawData.id;
        if (pKey === `ACT#${id}` && sKey === `ACT#${id}`) {
          const error = new Error();
          // This the error that DynamoDB will throw
          error.code = 'ConditionalCheckFailedException';
          throw error;
        }
      });

      await expect(service.updateAccount(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'notFound', safe: true }),
      );
    });

    it('throws if an outdated update occurred', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = { id: '123456789012', name: 'Computer Science Department Account', rev: 0 };
      let rev;

      service.findAccount = jest.fn((_request, { id }) => {
        if (id === rawData.id) return rawData;
        return undefined;
      });

      dbService.table.rev = jest.fn(revNumber => {
        rev = revNumber;
        return dbService.table;
      });

      dbService.table.update = jest.fn(() => {
        if (rev === 0) {
          const error = new Error();
          // This the error that DynamoDB will throw
          error.code = 'ConditionalCheckFailedException';
          throw error;
        }
      });

      await expect(service.updateAccount(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'outdatedUpdateAttempt', safe: true }),
      );
    });
  });
});
