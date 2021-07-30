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
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');

// Mocked dependencies
jest.mock('uuid/v1');
const uuidMock = require('uuid/v1');

jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/s3-service');
const S3ServiceMock = require('@aws-ee/base-services/lib/s3-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

const AwsAccountService = require('../aws-accounts-service');

describe('AwsAccountService', () => {
  let service = null;
  let dbService = null;
  let s3Service = null;
  let lockService = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('s3Service', new S3ServiceMock());
    container.register('awsAccountService', new AwsAccountService());
    container.register('aws', new AwsServiceMock());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('awsAccountService');
    dbService = await container.find('dbService');
    s3Service = await container.find('s3Service');
    lockService = await container.find('lockService');

    // Skip authorization by default
    service.assertAuthorized = jest.fn();
  });

  describe('find', () => {
    it('should return undefined for external guests', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'guest' } };
      const params = { id: '123', fields: [] };
      // OPERATE
      const response = await service.find(requestContext, params);
      // CHECK
      expect(response).toBe(undefined);
    });

    it('should return undefined for external researchers', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'external-researcher' } };
      const params = { id: '123', fields: [] };
      // OPERATE
      const response = await service.find(requestContext, params);
      // CHECK
      expect(response).toBe(undefined);
    });

    it('should return undefined for internal guests', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'internal-guest' } };
      const params = { id: '123', fields: [] };
      // OPERATE
      const response = await service.find(requestContext, params);
      // CHECK
      expect(response).toBe(undefined);
    });

    it('should return an aws account record successfully', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'admin' } };
      const params = { id: '123', fields: ['accountId', 'description'] };

      // Mock response from a get() to dynamodb
      dbService.table.get.mockReturnValue({
        id: '123',
        accountId: '01234567890',
        description: 'Research account',
      });

      // OPERATE
      const response = await service.find(requestContext, params);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: '123' });
      expect(dbService.table.projection).toHaveBeenCalledWith(['accountId', 'description']);
      expect(response).toMatchObject({
        id: '123',
        accountId: '01234567890',
        description: 'Research account',
      });
    });
  });

  describe('updateEnvironmentInstanceFilesBucketPolicy', () => {
    it('should set a policy on the bucket', async () => {
      // BUILD
      const s3Client = {};
      s3Client.putBucketPolicy = jest.fn();
      s3Client.putBucketPolicy.mockImplementationOnce(params => {
        const bucketPolicy = JSON.parse(params.Policy);
        expect(bucketPolicy).toMatchSnapshot(bucketPolicy);
        return { promise: jest.fn() };
      });

      s3Service.api = s3Client;
      s3Service.parseS3Details.mockReturnValue({
        s3BucketName: 'dummyBucket',
        s3Prefix: 'dummyKey',
      });

      const accountList = [{ accountId: '0123456789' }];
      service.list = jest.fn().mockReturnValueOnce(accountList);

      // Mock locking so that the putBucketPolicy actually gets called
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

      // OPERATE
      await service.updateEnvironmentInstanceFilesBucketPolicy();

      // CHECK
      expect(s3Client.putBucketPolicy).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const awsAccount = {
      name: 'my-aws-account',
      accountId: '012345678998',
    };

    it('should fail if user is not allowed to create account', async () => {
      // BUILD
      const requestContext = {};
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // OPERATE
      try {
        await service.create(requestContext, awsAccount);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('User is not authorized');
      }
    });

    it('should save awsAccount in the database with a new uuid', async () => {
      // BUILD
      const requestContext = {};
      service.updateEnvironmentInstanceFilesBucketPolicy = jest.fn();
      uuidMock.mockReturnValueOnce('abc-123-456');

      // OPERATE
      await service.create(requestContext, awsAccount);

      // CHECK
      expect(dbService.table.condition).toHaveBeenCalledWith('attribute_not_exists(id)');
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'abc-123-456' });
      expect(dbService.table.item).toHaveBeenCalledWith(expect.objectContaining(awsAccount));
      expect(dbService.table.update).toHaveBeenCalled();
    });

    it('should update the bucket policy', async () => {
      // BUILD
      const requestContext = {};
      service.updateEnvironmentInstanceFilesBucketPolicy = jest.fn();

      // OPERATE
      await service.create(requestContext, awsAccount);

      // CHECK
      expect(service.updateEnvironmentInstanceFilesBucketPolicy).toHaveBeenCalled();
    });

    it('should save an audit record', async () => {
      // BUILD
      const requestContext = {};
      service.updateEnvironmentInstanceFilesBucketPolicy = jest.fn();
      service.audit = jest.fn();

      // OPERATE
      await service.create(requestContext, awsAccount);

      // CHECK
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({
          action: 'create-aws-account',
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete the entry for the given account id', async () => {
      // BUILD
      const requestContext = {};
      const deleteRequest = { id: '123' };

      // OPERATE
      await service.delete(requestContext, deleteRequest);

      // CHECK
      expect(dbService.table.delete).toHaveBeenCalled();
      expect(dbService.table.key).toHaveBeenCalledWith({ id: '123' });
      expect(dbService.table.condition).toHaveBeenCalledWith('attribute_exists(id)');
    });

    it('should save an audit record', async () => {
      // BUILD
      const requestContext = {};
      const deleteRequest = { id: '123' };
      service.audit = jest.fn();

      // OPERATE
      await service.delete(requestContext, deleteRequest);

      // CHECK
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({
          action: 'delete-aws-account',
        }),
      );
    });
  });

  describe('list', () => {
    it('should return empty array if external guest', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'guest' } };
      // OPERATE
      const accounts = await service.list(requestContext);
      // CHECK
      expect(accounts.length).toBe(0);
    });

    it('should return empty array if external researcher', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'external-researcher' } };
      // OPERATE
      const accounts = await service.list(requestContext);
      // CHECK
      expect(accounts.length).toBe(0);
    });

    it('should return empty array if internal guest', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'internal-guest' } };
      // OPERATE
      const accounts = await service.list(requestContext);
      // CHECK
      expect(accounts.length).toBe(0);
    });

    it('should return a list of accounts', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'admin' } };
      const dummyAccounts = [{ id: '123' }, { id: '456' }];
      dbService.table.scan.mockReturnValueOnce(dummyAccounts);

      // OPERATE
      const accounts = await service.list(requestContext);

      // CHECK
      expect(accounts).toEqual(dummyAccounts);
      expect(dbService.table.scan).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const awsAccount = {
      id: 'xyz', // must have for an update
      rev: 2, // must have for an update
      name: 'my-aws-account',
      externalId: '012345678998',
      roleArn: 'arn:aws:iam::role/AccountRole',
      accountId: '012345678998',
      vpcId: 'vpc-abcdef123',
      subnetId: 'subnet-abcdef123',
      encryptionKeyArn: 'arn:aws:kms::key/someKey',
    };

    it('should fail if user is not allowed to update account', async () => {
      // BUILD
      const requestContext = {};
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // OPERATE
      try {
        await service.update(requestContext, awsAccount);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('User is not authorized');
      }
    });

    it('should update awsAccount in the database', async () => {
      // BUILD
      const requestContext = { username: 'oneUser' };
      service.updateEnvironmentInstanceFilesBucketPolicy = jest.fn();

      // OPERATE
      await service.update(requestContext, awsAccount);

      // CHECK
      expect(dbService.table.condition).toHaveBeenCalledWith('attribute_exists(id)');
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'xyz' });
      expect(dbService.table.update).toHaveBeenCalled();
    });

    it('should save an audit record', async () => {
      // BUILD
      const requestContext = {};
      service.updateEnvironmentInstanceFilesBucketPolicy = jest.fn();
      service.audit = jest.fn();

      // OPERATE
      await service.update(requestContext, awsAccount);

      // CHECK
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({
          action: 'update-aws-account',
        }),
      );
    });
  });
});
