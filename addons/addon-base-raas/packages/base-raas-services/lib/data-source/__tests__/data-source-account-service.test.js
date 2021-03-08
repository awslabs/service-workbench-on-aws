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

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const DBService = require('@aws-ee/base-services/lib/db-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const DataSourceBucketService = require('../data-source-bucket-service');
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
    container.register('dataSourceAccountService', new DataSourceAccountService());
    container.register('dataSourceBucketService', new DataSourceBucketService());
    await container.initServices();

    // Get instance of the service we are testing
    const aws = await container.find('aws');
    AwsMock.setSDKInstance(aws.sdk);

    service = await container.find('dataSourceAccountService');
    dbService = await container.find('dbService');
  });

  afterEach(() => {
    AwsMock.restore();
  });

  describe('register account', () => {
    it('should call DBService with correct input', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        id,
        name: 'Computer Science Department Account',
        mainRegion: 'us-east-1',
        description: 'This is a description. with long chars #/$ test test!',
        contactInfo: 'email@email.com',
      };

      await service.register(requestContext, rawData);

      expect(dbService.table.key).toHaveBeenCalledWith({ pk: `ACT#${id}`, sk: `ACT#${id}` });
      expect(dbService.table.item).toHaveBeenCalledWith(
        expect.objectContaining({
          ..._.omit(rawData, ['id']),
          qualifier: expect.stringContaining('swb-'),
          stack: expect.stringContaining('swb-'),
          status: 'pending',
          updatedBy: uid,
          createdBy: uid,
          rev: 0,
        }),
      );
    });

    it('only admins are allowed to register data source accounts', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const rawData = {
        id: '123456789012',
        name: 'Computer Science Department Account',
        mainRegion: 'us-east-1',
      };

      await expect(service.register(requestContext, rawData)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('throws if account already registered', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012',
        name: 'Computer Science Department Account',
        mainRegion: 'us-east-1',
      };
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

      await expect(service.register(requestContext, rawData)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'alreadyExists', safe: true }),
      );
    });

    it('fails because name is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012',
        name: '<!!>',
        mainRegion: 'us-east-1',
      };

      await expect(service.register(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because description is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012',
        name: 'test',
        mainRegion: 'us-east-1',
        description: 'This is a description. with long chars #/$ test test!<script>haxor</script>',
      };

      await expect(service.register(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because contactInfo is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012',
        name: 'test',
        mainRegion: 'us-east-1',
        description: 'This is a description',
        contactInfo: '<script>haxor</script>',
      };

      await expect(service.register(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });

  describe('update account', () => {
    it('should call DBService with correct input', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        id,
        name: 'Computer Science Department Account',
        rev: 2,
        description: 'valid description!',
        contactInfo: 'valid@email.com',
      };

      await service.update(requestContext, rawData);

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

      await expect(service.update(requestContext, rawData)).rejects.toThrow(
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

      await expect(service.update(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'notFound', safe: true }),
      );
    });

    it('throws if an outdated update occurred', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = { id: '123456789012', name: 'Computer Science Department Account', rev: 0 };
      let rev;

      service.find = jest.fn((_request, { id }) => {
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

      await expect(service.update(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'outdatedUpdateAttempt', safe: true }),
      );
    });

    it('fails because name is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012',
        rev: 1,
        name: '<!!>',
      };

      await expect(service.update(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because description is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012',
        rev: 1,
        name: 'test',
        description: 'This is a description. with long chars #/$ test test!<script>haxor</script>',
      };

      await expect(service.update(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because contactInfo is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012',
        rev: 1,
        name: 'test',
        description: 'This is a description',
        contactInfo: '<script>haxor</script>',
      };

      await expect(service.update(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because id is too long', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const rawData = {
        id: '123456789012111111',
        rev: 1,
        name: 'valid',
        description: 'This is a description',
      };

      await expect(service.update(requestContext, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });

  describe('list accounts', () => {
    it('only admins are allowed to list data source accounts', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };

      await expect(service.list(requestContext)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('list accounts with buckets as children', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const bucket1 = { accountId: '123456789011', name: 'bucket-1', region: 'us-east-1', partition: 'aws' };
      const bucket2 = { accountId: '123456789011', name: 'bucket-2', region: 'us-east-1', partition: 'aws' };
      const bucket3 = { accountId: '123456789012', name: 'bucket-3', region: 'us-east-1', partition: 'aws' };
      const acct1 = { id: '123456789011', name: 'account 1', mainRegion: 'us-east-1' };
      const acct2 = { id: '123456789012', name: 'account 2', mainRegion: 'us-east-2' };
      const acct3 = { id: '123456789013', name: 'account 3', mainRegion: 'us-east-1' };

      dbService.table.scan = jest.fn(() => {
        const result = [];
        _.forEach([bucket1, bucket2, bucket3], item => {
          result.push({ ..._.omit(item, ['accountId', 'name']), pk: `ACT#${item.accountId}`, sk: `BUK#${item.name}` });
        });
        _.forEach([acct1, acct2, acct3], item => {
          result.push({ ..._.omit(item, ['id']), pk: `ACT#${item.id}`, sk: `ACT#${item.id}` });
        });

        return result;
      });

      await expect(service.list(requestContext)).resolves.toStrictEqual([
        { ...acct1, status: 'reachable', buckets: [bucket1, bucket2] },
        { ...acct2, status: 'reachable', buckets: [bucket3] },
        { ...acct3, status: 'reachable', buckets: [] },
      ]);
    });
  });
});
