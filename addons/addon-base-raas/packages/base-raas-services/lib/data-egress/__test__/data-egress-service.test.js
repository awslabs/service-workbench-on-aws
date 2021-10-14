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
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('../../environment/service-catalog/environment-sc-service');

const AWSMock = require('aws-sdk-mock');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const S3Service = require('@aws-ee/base-services/lib/s3-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const EnvironmentScService = require('../../environment/service-catalog/environment-sc-service');
const DataEgressService = require('../data-egress-service');

jest.mock('../../helpers/utils', () => ({
  ...jest.requireActual('../../helpers/utils'),
  updateS3BucketPolicy: jest.fn(),
}));

const createAdminContext = ({ uid = 'uid-admin' } = {}) => ({
  principalIdentifier: { uid },
  principal: { isAdmin: true, userRole: 'admin', status: 'active' },
});

describe('DataEgressService', () => {
  let dataEgressService;
  let aws;
  let environmentScService;
  let s3Service;
  let lockService;
  let dbService;
  let auditWriterService;

  const testS3PolicyFn = () => {
    return {
      Statement: [
        {
          Sid: 'Get:test-id/',
          Effect: 'Allow',
          Principal: { AWS: 'arn:aws:iam::test-accountId:root' },
          Action: ['s3:GetObject'],
          Resource: ['arn:aws:s3:::test-egressStoreBucketName/test-id/*'],
        },
        {
          Sid: 'Put:test-id/',
          Effect: 'Allow',
          Principal: { AWS: 'arn:aws:iam::test-accountId:root' },
          Action: [
            's3:GetObject',
            's3:GetObjectVersion',
            's3:GetObjectTagging',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:PutObjectTagging',
            's3:DeleteObject',
            's3:DeleteObjectVersion',
          ],
          Resource: ['arn:aws:s3:::test-egressStoreBucketName/test-id/*'],
        },
        {
          Sid: 'List:test-id/',
          Effect: 'Allow',
          Principal: { AWS: 'arn:aws:iam::test-accountId:root' },
          Action: ['s3:ListBucket'],
          Resource: 'arn:aws:s3:::test-egressStoreBucketName',
          Condition: { StringLike: { 's3:prefix': ['test-id/*'] } },
        },
      ],
    };
  };

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
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
    auditWriterService = await container.find('auditWriterService');
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('create Egress Store', () => {
    it('should fail creating egress store without enable egress store feature', async () => {
      dataEgressService._settings = {
        getBoolean: settingName => {
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
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          return undefined;
        },
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
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
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
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };
      const roleArn = 'test-RoleArn';
      const environmentId = 'test-id';
      const requestContext = {};
      const rawEnvironment = {
        id: environmentId,
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
        roleArn,
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

      const createPolicyArn = 'test-policy-arn';
      AWSMock.mock('IAM', 'createPolicy', (params, callback) => {
        expect(params.PolicyName).toEqual(`swb-study-${environmentId}`);
        callback(null, {
          Policy: {
            Arn: createPolicyArn,
          },
        });
      });
      AWSMock.mock('IAM', 'createRole', (params, callback) => {
        expect(params.RoleName).toEqual(`swb-study-${environmentId}`);
        callback(null, {
          Role: {
            Arn: roleArn,
          },
        });
      });
      AWSMock.mock('IAM', 'attachRolePolicy', (params, callback) => {
        expect(params).toMatchObject({
          RoleName: `swb-study-${environmentId}`,
          PolicyArn: createPolicyArn,
        });
        callback();
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
      expect(result).toStrictEqual(mockEgressStoreInfo);
    });
  });
  describe('delete Egress Store', () => {
    it('should fail deleting egress store without enable egress store feature', async () => {
      dataEgressService._settings = {
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return false;
          }
          return undefined;
        },
      };
      const requestContext = {};
      await expect(dataEgressService.terminateEgressStore(requestContext, 'test-id/')).rejects.toThrow(
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
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };

      dbService.table.get.mockImplementationOnce(() => {
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

    it('should return null while no result returned from getEgressStoreInfo method', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };

      dbService.table.get.mockResolvedValue();
      const requestContext = {};
      const envId = 'test-id';

      const result = await dataEgressService.terminateEgressStore(requestContext, envId);
      expect(result).toStrictEqual(null);
    });

    it('should fail delete egress store while egress store is in PROCESSING status', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };

      dbService.table.get.mockResolvedValueOnce({
        status: 'PROCESSING',
        workspaceId: 'test-workspace-id',
        s3BucketName: 'test-s3BucketName',
        s3BucketPath: 'test-s3BucketPath',
        id: 'test-egress-store-id',
      });
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
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };

      const egressStoreId = 'test-egress-store-id';
      dbService.table.get.mockResolvedValueOnce({
        status: 'PROCESSED',
        workspaceId: 'test-workspace-id',
        s3BucketName: 'test-s3BucketName',
        s3BucketPath: 'test-s3BucketPath',
        id: egressStoreId,
      });
      const requestContext = {};
      const envId = 'test-workspace-id';

      AWSMock.mock('S3', 'listObjectsV2', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(null, {
          Contents: [],
        });
      });
      AWSMock.mock('S3', 'deleteObjects', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(null, {});
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

      await dataEgressService.terminateEgressStore(requestContext, envId);
    });

    it('should successfully delete egress store that is in CREATED state: deleteEgressStoreInCreatedStateTest = true', async () => {
      await deleteEgressStoreInCreatedStateTest(true);
    });

    it('should successfully delete egress store that is in CREATED state: deleteEgressStoreInCreatedStateTest = false', async () => {
      await deleteEgressStoreInCreatedStateTest(false);
    });

    async function deleteEgressStoreInCreatedStateTest(isAbleToSubmitEgressRequest) {
      const s3Policy = testS3PolicyFn();
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressStoreKmsKeyAliasArn') {
            return 'test-egressStoreKmsKeyAliasArn';
          }
          if (settingName === 'egressStoreBucketName') {
            return 'test-egressStoreBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };

      const egressStoreId = 'test-egress-store-id';
      dbService.table.get.mockResolvedValueOnce({
        status: 'CREATED',
        workspaceId: 'test-workspace-id',
        s3BucketName: 'test-s3BucketName',
        s3BucketPath: 'test-s3BucketPath',
        id: egressStoreId,
        isAbleToSubmitEgressRequest,
      });
      const requestContext = {};
      const envId = 'test-workspace-id';

      AWSMock.mock('S3', 'listObjectsV2', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(null, {
          Contents: [],
        });
      });
      AWSMock.mock('S3', 'deleteObjects', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(null, {});
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

      await dataEgressService.terminateEgressStore(requestContext, envId);
    }
  });

  describe('Get Egress Store info', () => {
    it('should get egress store info', async () => {
      dbService.table.get.mockResolvedValue({ workspaceId: 'test-egress-store-id' });

      const result = await dataEgressService.getEgressStoreInfo('test-egress-store-id');
      expect(result).toStrictEqual({
        workspaceId: 'test-egress-store-id',
      });
    });

    it('should error out egress store info', async () => {
      dbService.table.get.mockImplementationOnce(() => {
        throw new Error();
      });

      await expect(dataEgressService.getEgressStoreInfo()).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'notFound', safe: true }),
      );
    });

    it('should error out without finding egress store info', async () => {
      dbService.table.get.mockResolvedValue();

      const result = await dataEgressService.getEgressStoreInfo('test-egress-store-id');
      expect(result).toStrictEqual(null);
    });
  });

  describe('Notify egress info', () => {
    it('should prepare egress store snapshots', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          return undefined;
        },
      };
      AWSMock.mock('S3', 'listObjectsV2', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(null, { Contents: [{ key1: 'key1' }, { key2: 'key2' }] });
      });

      AWSMock.mock('S3', 'listObjectVersions', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(null, { Versions: [{ IsLatest: true }] });
      });

      AWSMock.mock('S3', 'putObject', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-egressNotificationBucketName',
        });
        callback(null, {});
      });

      const mockInfo = {
        id: 'test-id',
        s3BucketName: 'test-s3BucketName',
        s3BucketPath: 'test-s3BucketPath',
        ver: '0',
        egressStoreName: 'test-egressStoreName',
      };
      const result = await dataEgressService.prepareEgressStoreSnapshot(mockInfo);
      expect(result).toStrictEqual({
        bucket: 'test-egressNotificationBucketName',
        key: 'test-id/test-egressStoreName-ver1.json',
      });
    });
    it('should error when list s3 object error in preparing egress store snapshots', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          return undefined;
        },
      };

      AWSMock.mock('S3', 'listObjectsV2', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(new Error(), {});
      });
      s3Service.putObject = jest.fn();
      const mockInfo = {
        id: 'test-id',
        s3BucketName: 'test-s3BucketName',
        s3BucketPath: 'test-s3BucketPath',
        ver: '0',
        egressStoreName: 'test-egressStoreName',
      };

      await expect(dataEgressService.prepareEgressStoreSnapshot(mockInfo)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('should error when put object error in preparing egress store snapshots', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          return undefined;
        },
      };
      AWSMock.mock('S3', 'listObjectsV2', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-s3BucketName',
        });
        callback(new Error(), {});
      });
      const mockInfo = {
        id: 'test-id',
        s3BucketName: 'test-s3BucketName',
        s3BucketPath: 'test-s3BucketPath',
        ver: '0',
        egressStoreName: 'test-egressStoreName',
      };

      await expect(dataEgressService.prepareEgressStoreSnapshot(mockInfo)).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('should not notify SNS if egress feature is not enabled', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return false;
          }
          return undefined;
        },
      };
      await expect(dataEgressService.notifySNS({}, '')).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should not notify SNS if the egress store is not qualified to submit egress request', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };
      const requestContext = createAdminContext();
      const mockEgressStoreInfo = {
        id: 'id',
        egressStoreName: 'egressStoreName',
        createdAt: 'createdAt',
        createdBy: 'createdBy',
        workspaceId: 'workspaceId',
        projectId: 'projectId',
        s3BucketName: 's3BucketName',
        s3BucketPath: 's3BucketPath',
        status: 'status',
        updatedBy: 'updatedBy',
        updatedAt: 'updatedAt',
        ver: 'ver',
        isAbleToSubmitEgressRequest: false,
      };
      dbService.table.get.mockResolvedValue(mockEgressStoreInfo);

      await expect(dataEgressService.notifySNS(requestContext, 'workspaceId')).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('should not notify SNS if user is not authorized', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };

      const mockEgressStoreInfo = {
        id: 'id',
        egressStoreName: 'egressStoreName',
        createdAt: 'createdAt',
        createdBy: 'createdBy',
        workspaceId: 'workspaceId',
        projectId: 'projectId',
        s3BucketName: 's3BucketName',
        s3BucketPath: 's3BucketPath',
        status: 'status',
        updatedBy: 'updatedBy',
        updatedAt: 'updatedAt',
        ver: 'ver',
        isAbleToSubmitEgressRequest: true,
      };
      dbService.table.get.mockResolvedValue(mockEgressStoreInfo);
      const mockRequestContext = { principalIdentifier: { uid: 'test-createdBy' } };
      await expect(dataEgressService.notifySNS(mockRequestContext, 'workspaceId')).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should notify SNS', async () => {
      dataEgressService.audit = jest.fn();
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          if (settingName === 'egressNotificationSnsTopicArn') {
            return 'test-egressNotificationSnsTopicArn';
          }
          return undefined;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return undefined;
        },
      };

      const mockEgressStoreInfo = {
        id: 'id',
        egressStoreName: 'egressStoreName',
        createdAt: 'createdAt',
        createdBy: 'createdBy',
        workspaceId: 'workspaceId',
        projectId: 'projectId',
        s3BucketName: 's3BucketName',
        s3BucketPath: 's3BucketPath',
        status: 'status',
        updatedBy: 'updatedBy',
        updatedAt: 'updatedAt',
        ver: 0,
        isAbleToSubmitEgressRequest: true,
      };

      AWSMock.mock('S3', 'listObjectsV2', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 's3BucketName',
        });
        callback(null, { Contents: [] });
      });

      AWSMock.mock('S3', 'listObjectVersions', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 's3BucketName',
        });
        callback(null, { Versions: [{ IsLatest: true }] });
      });

      AWSMock.mock('S3', 'putObject', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-egressNotificationBucketName',
        });
        callback(null, {});
      });

      dbService.table.get.mockResolvedValue(mockEgressStoreInfo);
      const mockRequestContext = { principalIdentifier: { uid: 'createdBy' } };
      dataEgressService.lockAndUpdate = jest.fn();
      dataEgressService.publishMessage = jest.fn();

      await dataEgressService.notifySNS(mockRequestContext, 'workspaceId');
      expect(dataEgressService.audit).toHaveBeenCalledTimes(1);
      expect(dataEgressService.audit).toHaveBeenCalledWith(
        { principalIdentifier: { uid: 'createdBy' } },
        {
          action: 'trigger-egress-notification-process',
          body: {
            created_at: 'createdAt',
            created_by: 'createdBy',
            egress_store_id: 'id',
            egress_store_name: 'egressStoreName',
            egress_store_object_list_location:
              'arn:aws:s3:::test-egressNotificationBucketName/id/egressStoreName-ver1.json',
            id: expect.anything(),
            project_id: 'projectId',
            s3_bucketname: 's3BucketName',
            s3_bucketpath: 's3BucketPath',
            status: 'PENDING',
            updated_at: expect.anything(),
            updated_by: 'createdBy',
            ver: 1,
            workspace_id: 'workspaceId',
          },
        },
      );
    });
    it('should publish message', async () => {
      dataEgressService._settings = {
        get: settingName => {
          if (settingName === 'egressNotificationBucketName') {
            return 'test-egressNotificationBucketName';
          }
          if (settingName === 'egressNotificationSnsTopicArn') {
            return 'test-egressNotificationSnsTopicArn';
          }
          return null;
        },
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return null;
        },
      };
      AWSMock.mock('SNS', 'publish', (params, callback) => {
        expect(params).toMatchObject({
          Message: 'test-Message',
          TopicArn: 'test-egressNotificationSnsTopicArn',
        });
        callback(null, {});
      });

      await dataEgressService.publishMessage('test-Message');
    });

    it('should enable egress submission flag', async () => {
      dataEgressService.lockAndUpdate = jest.fn();
      await dataEgressService.enableEgressStoreSubmission({ id: 'test-id' });
      expect(dataEgressService.lockAndUpdate).toHaveBeenCalledWith('egress-store-ddb-access-test-id', 'test-id', {
        id: 'test-id',
        isAbleToSubmitEgressRequest: true,
      });
    });
  });

  describe('should audit', () => {
    it('should audit', async () => {
      const mockRC = {};
      const mockAuditEvent = '';

      await dataEgressService.audit(mockRC, mockAuditEvent);
      expect(auditWriterService.writeAndForget).toHaveBeenCalledWith(mockRC, mockAuditEvent);
    });
  });

  describe('should transform from byte to size', () => {
    it('should return in Byte', async () => {
      const result = dataEgressService.bytesToSize(100);
      expect(result).toStrictEqual('100 Bytes');
    });

    it('should return in KB', async () => {
      const result = dataEgressService.bytesToSize(10000);
      expect(result).toStrictEqual('10 KB');
    });

    it('should return in MB', async () => {
      const result = dataEgressService.bytesToSize(10000000);
      expect(result).toStrictEqual('10 MB');
    });

    it('should return in GB', async () => {
      const result = dataEgressService.bytesToSize(10000000000);
      expect(result).toStrictEqual('9 GB');
    });

    it('should return in TB', async () => {
      const result = dataEgressService.bytesToSize(10000000000000);
      expect(result).toStrictEqual('9 TB');
    });

    it('should return in PB', async () => {
      const result = dataEgressService.bytesToSize(10000000000000000);
      expect(result).toStrictEqual('9 PB');
    });

    it('should only return in PB for objects larger than 1024 PB', async () => {
      const result = dataEgressService.bytesToSize(10000000000000000000);
      expect(result).toStrictEqual('8882 PB');
    });
  });

  describe('should get Egress Store objects', () => {
    it('should get Egress Store objects', async () => {
      dataEgressService._settings = {
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return null;
        },
      };
      const mockEgressStoreInfo = {
        id: 'id',
        egressStoreName: 'egressStoreName',
        createdAt: 'createdAt',
        createdBy: 'createdBy',
        workspaceId: 'workspaceId',
        projectId: 'projectId',
        s3BucketName: 's3BucketName',
        s3BucketPath: 's3BucketPath',
        status: 'status',
        updatedBy: 'updatedBy',
        updatedAt: 'updatedAt',
        ver: 'ver',
        isAbleToSubmitEgressRequest: false,
      };
      const mockRequestContext = { principalIdentifier: { uid: 'createdBy' } };
      dataEgressService.getEgressStoreInfo = jest.fn().mockResolvedValueOnce(mockEgressStoreInfo);
      s3Service.listAllObjects = jest.fn().mockResolvedValueOnce([
        { LastModified: new Date(), Size: 2, Key: 'test/test2' },
        { LastModified: new Date(), Size: 3, Key: 'test/test1' },
      ]);

      const result = await dataEgressService.getEgressStore(mockRequestContext, 'test-environmentId');
      expect(result).toStrictEqual({
        isAbleToSubmitEgressRequest: false,
        objectList: [
          {
            Key: 'test2',
            LastModified: expect.anything(),
            Size: '2 Bytes',
            projectId: 'projectId',
            workspaceId: 'workspaceId',
          },
          {
            Key: 'test1',
            LastModified: expect.anything(),
            Size: '3 Bytes',
            projectId: 'projectId',
            workspaceId: 'workspaceId',
          },
        ],
      });
    });
    it('should error out without enable egress feature', async () => {
      dataEgressService._settings = {
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return false;
          }
          return null;
        },
      };
      const mockEgressStoreInfo = {
        id: 'id',
        egressStoreName: 'egressStoreName',
        createdAt: 'createdAt',
        createdBy: 'createdBy',
        workspaceId: 'workspaceId',
        projectId: 'projectId',
        s3BucketName: 's3BucketName',
        s3BucketPath: 's3BucketPath',
        status: 'status',
        updatedBy: 'updatedBy',
        updatedAt: 'updatedAt',
        ver: 'ver',
        isAbleToSubmitEgressRequest: false,
      };
      const mockRequestContext = { principalIdentifier: { uid: 'createdBy' } };
      dataEgressService.getEgressStoreInfo = jest.fn().mockResolvedValueOnce(mockEgressStoreInfo);
      s3Service.listAllObjects = jest.fn().mockResolvedValueOnce([
        { LastModified: new Date(), Size: 2, Key: 'test/test2' },
        { LastModified: new Date(), Size: 3, Key: 'test/test1' },
      ]);

      await expect(dataEgressService.getEgressStore(mockRequestContext, 'test-environmentId')).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });

    it('should error out with unauthorized user', async () => {
      dataEgressService._settings = {
        getBoolean: settingName => {
          if (settingName === 'enableEgressStore') {
            return true;
          }
          return null;
        },
      };
      const mockEgressStoreInfo = {
        id: 'id',
        egressStoreName: 'egressStoreName',
        createdAt: 'createdAt',
        createdBy: 'createdBy',
        workspaceId: 'workspaceId',
        projectId: 'projectId',
        s3BucketName: 's3BucketName',
        s3BucketPath: 's3BucketPath',
        status: 'status',
        updatedBy: 'updatedBy',
        updatedAt: 'updatedAt',
        ver: 'ver',
        isAbleToSubmitEgressRequest: false,
      };
      const mockRequestContext = { principalIdentifier: { uid: 'test-createdBy' } };
      dataEgressService.getEgressStoreInfo = jest.fn().mockResolvedValueOnce(mockEgressStoreInfo);
      s3Service.listAllObjects = jest.fn().mockResolvedValueOnce([
        { LastModified: new Date(), Size: 2, Key: 'test/test2' },
        { LastModified: new Date(), Size: 3, Key: 'test/test1' },
      ]);

      await expect(dataEgressService.getEgressStore(mockRequestContext, 'test-environmentId')).rejects.toThrow(
        // It is better to check using boom.code instead of just the actual string, unless
        // there are a few errors with the exact same boom code but different messages.
        // Note: if you encounter a case where a service is throwing exceptions with the
        // same code but different messages (to address different scenarios), you might
        // want to suggest to the service author to use different codes.
        expect.objectContaining({ boom: true, code: 'forbidden', safe: true }),
      );
    });
  });

  it('should successfully delete egress store role', async () => {
    // BUILD
    const policyArn = 'test-PermissionBoundaryArn';
    AWSMock.mock('IAM', 'listAttachedRolePolicies', (params, callback) => {
      expect(params.RoleName).toEqual(`swb-study-${egressStoreId}`);
      callback(null, {
        AttachedPolicies: [
          {
            PolicyName: 'test-PermissionBoundaryName',
            PolicyArn: policyArn,
          },
        ],
      });
    });
    AWSMock.mock('IAM', 'detachRolePolicy', (params, callback) => {
      expect(params).toMatchObject({ RoleName: `swb-study-${egressStoreId}`, PolicyArn: policyArn });
      callback();
    });
    AWSMock.mock('IAM', 'deleteRole', (params, callback) => {
      expect(params).toMatchObject({ RoleName: `swb-study-${egressStoreId}` });
      callback();
    });
    AWSMock.mock('IAM', 'deletePolicy', (params, callback) => {
      expect(params).toMatchObject({ PolicyArn: policyArn });
      callback();
    });

    const egressStoreId = 'abc';

    // OPERATE and CHECK
    await expect(dataEgressService.deleteMainAccountEgressStoreRole(egressStoreId)).resolves.toBeUndefined();
  });
});
