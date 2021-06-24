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
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/s3-service');
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
jest.mock('../../environment/service-catalog/environment-sc-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');

const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const S3Service = require('@aws-ee/base-services/lib/s3-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const AWSMock = require('aws-sdk-mock');
const EnvironmentScService = require('../../environment/service-catalog/environment-sc-service');
const DataEgressService = require('../data-egress-service');

describe('DataEgressService', () => {
  let container;
  let dataEgressService;
  let aws;
  let environmentScService;
  let s3Service;
  let lockService;
  let dbService;

  const testS3PolicyFn = () => {
    return {
      Statement: [
        {
          Sid: 'Get:test-id',
          Effect: 'Allow',
          Principal: { AWS: ['arn:aws:iam::test-accountId:root'] },
          Action: ['s3:GetObject'],
          Resource: ['arn:aws:s3:::test-egressStoreBucketNametest-id*'],
        },
        {
          Sid: 'Put:test-id',
          Effect: 'Allow',
          Principal: { AWS: ['arn:aws:iam::test-accountId:root'] },
          Action: [
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:DeleteObject',
          ],
          Resource: ['arn:aws:s3:::test-egressStoreBucketNametest-id*'],
        },
        {
          Sid: 'List:test-id',
          Effect: 'Allow',
          Principal: { AWS: ['arn:aws:iam::test-accountId:root'] },
          Action: ['s3:ListBucket'],
          Resource: 'arn:aws:s3:::test-egressStoreBucketName',
          Condition: { StringLike: { 's3:prefix': ['test-id*'] } },
        },
      ],
    };
  };

  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    container.register('aws', new AwsService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditWriterService());
    container.register('settings', new SettingsServiceMock());
    container.register('s3Service', new S3Service());
    container.register('lockService', new LockService());
    container.register('environmentScService', new EnvironmentScService());
    container.register('dataEgressService', new DataEgressService());
    await container.initServices();

    // Get instance of the service we are testing
    dataEgressService = await container.find('dataEgressService');
    aws = await dataEgressService.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
    environmentScService = await dataEgressService.service('environmentScService');
    environmentScService.getMemberAccount = jest.fn().mockResolvedValue({ accountId: 'test-accountId' });
    s3Service = await container.find('s3Service');
    lockService = await container.find('lockService');
    dbService = await dataEgressService.service('dbService');
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('create Egress Store', () => {
    it('should fail creating egress store without enable egress store feature', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return false;
          }
          return undefined;
        },
      };
      const requestContext = {};
      const rawEnvironment = {
        id: 'test-id',
        name: 'test-raw-environment-name',
        createdBy: 'test-raw-environment-createdby',
        projectId: 'test-raw-environment-projectId',
      };

      await expect(dataEgressService.createEgressStore(requestContext, rawEnvironment)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should fail creating egress store with wrong schema', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };
      const requestContext = {};
      const rawEnvironment = {
        id: 'test-id',
        name: 'test-raw-environment-name',
        createdBy: 'test-raw-environment-createdby',
        projectId: 'test-raw-environment-projectId',
      };

      await expect(dataEgressService.createEgressStore(requestContext, rawEnvironment)).rejects.toThrow(
        expect.objectContaining({
          boom: true,
          code: 'badRequest',
          safe: true,
          message: 'Input has validation errors',
        }),
      );
    });

    it('should fail creating with create s3 path fail', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
      };

      s3Service.createPath = jest.fn(() => {
        throw new Error();
      });
      const requestContext = {};
      const rawEnvironment = {
        id: 'test-id',
        name: 'test-raw-environment-name',
        createdBy: 'test-raw-environment-createdby',
        updatedBy: 'test-updatedBy',
        projectId: 'test-raw-environment-projectId',
        rev: 0,
        inWorkflow: 'test-inWorkflow',
        status: 'test-status',
        cidr: '0.0.0.0',
        createdAt: 'testCreatedAt',
        updatedAt: 'testUpdatedAt',
        studyIds: [],
        indexId: 'testIndexId',
        description: 'testDescription',
        envTypeConfigId: 'envTypeConfigId',
        envTypeId: 'envTypeId',
        hasConnections: true,
      };

      await expect(dataEgressService.createEgressStore(requestContext, rawEnvironment)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('should create egress store with egress store feature enabled', async () => {
      const s3Policy = testS3PolicyFn();
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
      };
      const requestContext = {};
      const rawEnvironment = {
        id: 'test-id',
        name: 'test-raw-environment-name',
        createdBy: 'test-raw-environment-createdby',
        updatedBy: 'test-updatedBy',
        projectId: 'test-raw-environment-projectId',
        rev: 0,
        inWorkflow: 'test-inWorkflow',
        status: 'test-status',
        cidr: '0.0.0.0',
        createdAt: 'testCreatedAt',
        updatedAt: 'testUpdatedAt',
        studyIds: [],
        indexId: 'testIndexId',
        description: 'testDescription',
        envTypeConfigId: 'envTypeConfigId',
        envTypeId: 'envTypeId',
        hasConnections: true,
      };

      const mockEgressStoreInfo = {
        id: `egress-store-${rawEnvironment.id}`,
        readable: true,
        writeable: true,
        kmsArn: 'test-arn',
        bucket: 'test-egressStoreBucketName',
        prefix: 'test-id/',
        envPermission: {
          read: true,
          write: true,
        },
        status: 'reachable',
        createdBy: rawEnvironment.createdBy,
        workspaceId: rawEnvironment.id,
        projectId: rawEnvironment.projectId,
        resources: [
          {
            arn: `arn:aws:s3:::test-egressStoreBucketName/${rawEnvironment.id}/`,
          },
        ],
      };
      AWSMock.mock('KMS', 'describeKey', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'test-egressStoreKmsKeyAliasArn',
        });
        callback(null, {
          KeyMetadata: {
            Arn: 'test-arn',
          },
        });
      });

      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-egressStoreBucketName',
        });
        callback(null, {
          Policy: JSON.stringify(s3Policy),
        });
      });

      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-egressStoreBucketName',
        });
        callback(null, {});
      });
      // Mock locking so that the putBucketPolicy actually gets called
      lockService.tryWriteLockAndRun = jest.fn((_params, callback) => callback());
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);

      const result = await dataEgressService.createEgressStore(requestContext, rawEnvironment);
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(mockEgressStoreInfo);
    });
  });
  describe('delete Egress Store', () => {
    it('should fail deleting egress store without enable egress store feature', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return false;
          }
          return undefined;
        },
      };
      const requestContext = {};
      await expect(dataEgressService.terminateEgressStore(requestContext, 'test-id')).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should fail delete egress store with scanning the DDB table', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
      };

      dbService.table.scan.mockImplementationOnce(() => {
        throw new Error();
      });
      const requestContext = {};
      const envId = 'test-id';

      await expect(dataEgressService.terminateEgressStore(requestContext, envId)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'notFound', safe: true }),
      );
    });

    it('should fail delete egress store while egress store is in PROCESSING status', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
      };

      dbService.table.scan.mockResolvedValue([
        {
          status: 'PROCESSING',
          workspaceId: 'test-workspace-id',
          s3BucketName: 'test-s3BucketName',
          s3BucketPath: 'test-s3BucketPath',
          id: 'test-egress-store-id',
        },
      ]);
      const requestContext = {};
      const envId = 'test-workspace-id';

      await expect(dataEgressService.terminateEgressStore(requestContext, envId)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should success delete egress store while egress store is not in PROCESSING status', async () => {
      const s3Policy = testS3PolicyFn();
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
      };

      dbService.table.scan.mockResolvedValue([
        {
          status: 'PROCESSED',
          workspaceId: 'test-workspace-id',
          s3BucketName: 'test-s3BucketName',
          s3BucketPath: 'test-s3BucketPath',
          id: 'test-egress-store-id',
        },
      ]);
      const requestContext = {};
      const envId = 'test-workspace-id';

      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-egressStoreBucketName',
        });
        callback(null, {
          Policy: JSON.stringify(s3Policy),
        });
      });

      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-egressStoreBucketName',
        });
        callback(null, {});
      });
      // Mock locking so that the putBucketPolicy actually gets called
      lockService.tryWriteLockAndRun = jest.fn((_params, callback) => callback());
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);

      await dataEgressService.terminateEgressStore(requestContext, envId);
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });
  });
});
