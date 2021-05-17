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

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const DBService = require('@aws-ee/base-services/lib/db-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const DataSourceBucketService = require('../data-source-bucket-service');

describe('DataSourceBucketService', () => {
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
    container.register('dataSourceBucketService', new DataSourceBucketService());
    await container.initServices();

    service = await container.find('dataSourceBucketService');
    dbService = await container.find('dbService');
  });

  describe('register bucket', () => {
    it('should call DBService with correct input', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        access: 'roles',
        sse: 'kms',
      };

      await service.register(requestContext, { id }, rawData);

      expect(dbService.table.key).toHaveBeenCalledWith({ pk: `ACT#${id}`, sk: `BUK#${rawData.name}` });
      expect(dbService.table.item).toHaveBeenCalledWith(
        expect.objectContaining({
          ..._.omit(rawData, ['name']),
          updatedBy: uid,
          createdBy: uid,
          rev: 0,
        }),
      );
    });

    it('should call DBService when sse is s3', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        awsPartition: 'aws',
        access: 'roles',
        sse: 's3',
      };

      await service.register(requestContext, { id }, rawData);

      expect(dbService.table.key).toHaveBeenCalledWith({ pk: `ACT#${id}`, sk: `BUK#${rawData.name}` });
      expect(dbService.table.item).toHaveBeenCalledWith(
        expect.objectContaining({
          ..._.omit(rawData, ['name']),
          updatedBy: uid,
          createdBy: uid,
          rev: 0,
        }),
      );
    });

    it('only admins are allowed to create data source bucket', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        partition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('throws if bucket already registered', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        access: 'roles',
        sse: 'kms',
      };

      let pKey;
      let sKey;
      dbService.table.key = jest.fn(({ pk, sk }) => {
        pKey = pk;
        sKey = sk;
        return dbService.table;
      });

      dbService.table.update = jest.fn(() => {
        if (pKey === `ACT#${id}` && sKey === `BUK#${rawData.name}`) {
          const error = new Error();
          // This the error that DynamoDB will throw
          error.code = 'ConditionalCheckFailedException';
          throw error;
        }
      });

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'alreadyExists', safe: true }),
      );
    });

    it('fails because accountId is too long', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '12345678901214354253454';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        access: 'roles',
        sse: 'kms',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because kmsArn is empty with kms as sse', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: '',
        access: 'roles',
        sse: 'kms',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because kmsArn is empty with s3 as sse', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: '',
        access: 'roles',
        sse: 's3',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because name is long', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucketbucketbucketbucketbucketbucketbucketbucketbucketbucketbucket',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        access: 'roles',
        sse: 'kms',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because name has wildcard ?', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket?',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        access: 'roles',
        sse: 'kms',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because name has wildcard *', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket*',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        access: 'roles',
        sse: 'kms',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because name is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1##<hack>',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'arn:aws:kms:us-east-1:123456789101:key/2e3c97b6-8bb3-4cf8-bc77-d56ebf84test',
        access: 'roles',
        sse: 'kms',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because kmsArn is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };
      const id = '123456789012';
      const rawData = {
        name: 'bucket-1',
        region: 'us-east-1',
        awsPartition: 'aws',
        kmsArn: 'invalid',
        access: 'roles',
        sse: 'kms',
      };

      await expect(service.register(requestContext, { id }, rawData)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });
});
