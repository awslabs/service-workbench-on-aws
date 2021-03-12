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
jest.mock('@aws-ee/base-services/lib/json-schema-validation-service');
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');

const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const DBService = require('@aws-ee/base-services/lib/db-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AWSMock = require('aws-sdk-mock');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const ResourceUsageService = require('../../usage/resource-usage-service');
const EnvironmentResourceService = require('../access-strategy/legacy/environment-resource-service');

describe('EnvironmentResourceService', () => {
  let environmentResourceService;
  let aws;
  let lockService;
  let usageService;

  const testStudiesFn = () => [
    {
      category: 'My Studies',
      description: 'Study1',
      id: 'Study1',
      name: 'Study1',
      resources: [
        {
          arn: 'arn:aws:s3:::study-bucket/studies/Organization/Study1/',
        },
      ],
      envPermission: {
        read: true,
        write: true,
      },
    },
    {
      category: 'Organization',
      description: 'Study2',
      id: 'Study2',
      name: 'Study2',
      envPermission: {
        read: true,
      },
      resources: [
        {
          arn: 'arn:aws:s3:::study-bucket/studies/users/user1/Study2/',
        },
        {
          arn: 'arn:aws:s3:::study-bucket/TO_BE_IGNORED/',
        },
      ],
    },
  ];

  const testS3PolicyFn = () => {
    return {
      Statement: [
        {
          Sid: 'Get:studies/Organization/Study1/',
          Effect: 'Allow',
          Principal: {
            AWS: ['arn:aws:iam::accountId1:root'],
          },
          Action: ['s3:GetObject'],
          Resource: ['arn:aws:s3:::study-bucket/studies/Organization/Study1/*'],
        },
        {
          Sid: 'Put:studies/Organization/Study1/',
          Effect: 'Allow',
          Principal: {
            AWS: ['arn:aws:iam::accountId1:root'],
          },
          Action: [
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:DeleteObject',
          ],
          Resource: ['arn:aws:s3:::study-bucket/studies/Organization/Study1/*'],
        },
        {
          Sid: 'List:studies/Organization/Study1/',
          Effect: 'Allow',
          Principal: {
            AWS: ['arn:aws:iam::accountId1:root'],
          },
          Action: ['s3:ListBucket'],
          Resource: 'arn:aws:s3:::study-bucket',
          Condition: {
            StringLike: {
              's3:prefix': ['studies/Organization/Study1/*'],
            },
          },
        },
        {
          Sid: 'Get:studies/users/user1/Study2/',
          Effect: 'Allow',
          Principal: {
            AWS: ['arn:aws:iam::accountId1:root'],
          },
          Action: ['s3:GetObject'],
          Resource: ['arn:aws:s3:::study-bucket/studies/users/user1/Study2/*'],
        },
        {
          Sid: 'List:studies/users/user1/Study2/',
          Effect: 'Allow',
          Principal: {
            AWS: ['arn:aws:iam::accountId1:root'],
          },
          Action: ['s3:ListBucket'],
          Resource: 'arn:aws:s3:::study-bucket',
          Condition: {
            StringLike: {
              's3:prefix': ['studies/users/user1/Study2/*'],
            },
          },
        },
      ],
    };
  };

  const statementSortFn = (statement1, statement2) => {
    if (statement1.Sid < statement2.Sid) {
      return -1;
    }
    if (statement1.Sid > statement2.Sid) {
      return 1;
    }
    return 0;
  };

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('log', new Logger());
    container.register('aws', new AwsService());
    container.register('auditWriterService', new AuditWriterService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('lockService', new LockService());
    container.register('resourceUsageService', new ResourceUsageService());
    container.register('environmentResourceService', new EnvironmentResourceService());
    container.register('dbService', new DBService());
    container.register('settings', new SettingsService());

    await container.initServices();

    environmentResourceService = await container.find('environmentResourceService');
    lockService = await container.find('lockService');
    usageService = await container.find('resourceUsageService');
    aws = await environmentResourceService.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
    environmentResourceService._settings = {
      get: settingName => {
        if (settingName === 'studyDataBucketName') {
          return 'study-bucket';
        }
        if (settingName === 'studyDataKmsPolicyWorkspaceSid') {
          return 'KMS Policy';
        }
        if (settingName === 'studyDataKmsKeyArn') {
          return 'studyKmsKeyAlias';
        }
        return undefined;
      },
    };
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('addToBucketPolicy', () => {
    it('add new studies to an empty bucket policy', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: '{}' });
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
          Policy: JSON.stringify(s3Policy),
        });
        callback(null, {});
      });
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      await environmentResourceService.addToBucketPolicy({}, studies, 'accountId1');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('add new studies to an existing bucket policy', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      // Add accountId2 to Study1
      const newPolicy = { ...s3Policy };
      const study1 = studies.filter(study => study.id.includes('Study1'));
      newPolicy.Statement.map(statement => {
        if (statement.Sid.includes('Study1')) {
          statement.Principal.AWS.push('arn:aws:iam::accountId2:root');
        }
        return statement;
      });
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: JSON.stringify(s3Policy) });
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params.Bucket).toEqual('study-bucket');
        newPolicy.Statement.sort(statementSortFn);
        const receivedPolicy = JSON.parse(params.Policy);
        receivedPolicy.Statement.sort(statementSortFn);
        expect(receivedPolicy).toEqual(newPolicy);
        callback(null, {});
      });

      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      await environmentResourceService.addToBucketPolicy({}, study1, 'accountId2');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('ensure that open data studies are ignored', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      const openDataStudy = {
        category: 'Open Data',
        description: 'OpenData1',
        id: 'OpenData1',
        name: 'OpenData1',
        resources: [
          {
            arn: 'arn:aws:s3:::study-bucket/OpenData1/',
          },
        ],
        envPermission: {
          read: true,
          write: true,
        },
      };
      studies.push(openDataStudy);
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: JSON.stringify(s3Policy) });
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
          Policy: JSON.stringify(s3Policy),
        });
        callback(null, {});
      });
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      // this should be a no-op
      await environmentResourceService.addToBucketPolicy({}, studies, 'accountId1');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('ensure that studies belonging to anything but internal bucket are ignored', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      const myStudyInExternalBucket = {
        category: 'My Studies',
        description: 'Study3',
        id: 'Study3',
        name: 'Study3',
        resources: [
          {
            arn: 'arn:aws:s3:::some-external-bucket/Study3/',
          },
        ],
        envPermission: {
          read: true,
          write: true,
        },
      };
      studies.push(myStudyInExternalBucket);
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: JSON.stringify(s3Policy) });
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
          Policy: JSON.stringify(s3Policy),
        });
        callback(null, {});
      });
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      // this should be a no-op
      await environmentResourceService.addToBucketPolicy({}, studies, 'accountId1');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('ensure that studies without envPermissions are ignored', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      const myStudy3 = {
        category: 'My Studies',
        description: 'Study3',
        id: 'Study3',
        name: 'Study3',
        resources: [
          {
            arn: 'arn:aws:s3:::study-bucket/Study3/',
          },
        ],
        envPermission: {
          read: false,
          write: false,
        },
      };
      const myStudy4 = {
        category: 'My Studies',
        description: 'Study4',
        id: 'Study4',
        name: 'Study4',
        resources: [
          {
            arn: 'arn:aws:s3:::study-bucket/Study4/',
          },
        ],
      };
      const myStudy5 = {
        category: 'My Studies',
        description: 'Study5',
        id: 'Study5',
        name: 'Study5',
        resources: [
          {
            arn: 'arn:aws:s3:::study-bucket/Study5/',
          },
        ],
        envPermission: {
          write: false,
        },
      };
      const myStudy6 = {
        category: 'My Studies',
        description: 'Study6',
        id: 'Study6',
        name: 'Study6',
        resources: [
          {
            arn: 'arn:aws:s3:::study-bucket/Study6/',
          },
        ],
        envPermission: {
          read: false,
        },
      };
      studies.push(myStudy3);
      studies.push(myStudy4);
      studies.push(myStudy5);
      studies.push(myStudy6);
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: JSON.stringify(s3Policy) });
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
          Policy: JSON.stringify(s3Policy),
        });
        callback(null, {});
      });
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      // this should be a no-op
      await environmentResourceService.addToBucketPolicy({}, studies, 'accountId1');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeFromBucketPolicy', () => {
    it('remove all studies from bucket policy', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: JSON.stringify(s3Policy) });
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
          Policy: JSON.stringify({
            Statement: [],
          }),
        });
        callback(null, {});
      });
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      await environmentResourceService.removeFromBucketPolicy({}, studies, 'accountId1');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('remove one study completely from bucket policy', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      const newPolicy = { ...s3Policy };
      newPolicy.Statement = newPolicy.Statement.filter(statement => !statement.Sid.includes('Study1'));
      const newStudies = studies.filter(study => study.id.includes('Study1'));
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: JSON.stringify(s3Policy) });
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
          Policy: JSON.stringify(newPolicy),
        });
        callback(null, {});
      });
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      await environmentResourceService.removeFromBucketPolicy({}, newStudies, 'accountId1');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('remove one account from a study', async () => {
      const studies = testStudiesFn();
      const s3Policy = testS3PolicyFn();
      const policyWithMultipleAccounts = { ...s3Policy };
      policyWithMultipleAccounts.Statement.map(statement => {
        statement.Principal.AWS = ['arn:aws:iam::accountId1:root', 'arn:aws:iam::accountId2:root'];
        return statement;
      });
      // remove accountId1 from Study1
      const newStudies = studies.filter(study => study.id.includes('Study1'));
      AWSMock.mock('S3', 'getBucketPolicy', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'study-bucket',
        });
        callback(null, { Policy: JSON.stringify(policyWithMultipleAccounts) });
      });
      const newExpectedPolicy = { ...policyWithMultipleAccounts };
      newExpectedPolicy.Statement.map(statement => {
        if (statement.Sid.includes('Study1')) {
          statement.Principal.AWS = ['arn:aws:iam::accountId2:root'];
        }
        return statement;
      });
      const putBucketPolicyMock = jest.fn((params, callback) => {
        expect(params.Bucket).toEqual('study-bucket');
        const receivedPolicy = JSON.parse(params.Policy);
        receivedPolicy.Statement.sort(statementSortFn);
        newExpectedPolicy.Statement.sort(statementSortFn);
        expect(receivedPolicy).toEqual(newExpectedPolicy);
        callback(null, {});
      });
      AWSMock.mock('S3', 'putBucketPolicy', putBucketPolicyMock);
      await environmentResourceService.removeFromBucketPolicy({}, newStudies, 'accountId1');
      expect(putBucketPolicyMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('addToKmsKeyPolicy', () => {
    it('add new principal to KMS policy with no principals', async () => {
      AWSMock.mock('KMS', 'describeKey', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'studyKmsKeyAlias',
        });
        callback(null, { KeyMetadata: { KeyId: 'kmsStudyKeyId' } });
      });
      AWSMock.mock('KMS', 'getKeyPolicy', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
        });
        callback(null, { Policy: '{}' });
      });
      const expectedKMSPolicy = {
        Statement: [
          {
            Sid: 'KMS Policy',
            Effect: 'Allow',
            Principal: {
              AWS: ['arn:aws:iam::accountId1:root'],
            },
            Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
            Resource: '*',
          },
        ],
      };
      const putKeyPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
          Policy: JSON.stringify(expectedKMSPolicy),
        });
        callback(null, {});
      });
      AWSMock.mock('KMS', 'putKeyPolicy', putKeyPolicyMock);
      await environmentResourceService.addToKmsKeyPolicy({}, 'accountId1');
      expect(putKeyPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('add new principal to KMS policy with multiple principals', async () => {
      const oldKMSPolicy = {
        Statement: [
          {
            Sid: 'KMS Policy',
            Effect: 'Allow',
            Principal: {
              AWS: ['arn:aws:iam::accountId1:root'],
            },
            Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
            Resource: '*',
          },
        ],
      };
      AWSMock.mock('KMS', 'describeKey', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'studyKmsKeyAlias',
        });
        callback(null, { KeyMetadata: { KeyId: 'kmsStudyKeyId' } });
      });
      AWSMock.mock('KMS', 'getKeyPolicy', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
        });
        callback(null, { Policy: JSON.stringify(oldKMSPolicy) });
      });
      const newKMSPolicy = {
        Statement: [
          {
            Sid: 'KMS Policy',
            Effect: 'Allow',
            Principal: {
              AWS: ['arn:aws:iam::accountId1:root', 'arn:aws:iam::accountId2:root'],
            },
            Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
            Resource: '*',
          },
        ],
      };
      const putKeyPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
          Policy: JSON.stringify(newKMSPolicy),
        });
        callback(null, {});
      });
      AWSMock.mock('KMS', 'putKeyPolicy', putKeyPolicyMock);
      await environmentResourceService.addToKmsKeyPolicy({}, 'accountId2');
      expect(putKeyPolicyMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeFromKmsKeyPolicy', () => {
    it('remove last left principal from KMS policy', async () => {
      const oldKMSPolicy = {
        Statement: [
          {
            Sid: 'KMS Policy',
            Effect: 'Allow',
            Principal: {
              AWS: ['arn:aws:iam::accountId1:root'],
            },
            Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
            Resource: '*',
          },
        ],
      };
      AWSMock.mock('KMS', 'describeKey', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'studyKmsKeyAlias',
        });
        callback(null, { KeyMetadata: { KeyId: 'kmsStudyKeyId' } });
      });
      AWSMock.mock('KMS', 'getKeyPolicy', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
        });
        callback(null, { Policy: JSON.stringify(oldKMSPolicy) });
      });
      const putKeyPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
          Policy: JSON.stringify({
            Statement: [],
          }),
        });
        callback(null, {});
      });
      AWSMock.mock('KMS', 'putKeyPolicy', putKeyPolicyMock);
      await environmentResourceService.removeFromKmsKeyPolicy({}, 'accountId1');
      expect(putKeyPolicyMock).toHaveBeenCalledTimes(1);
    });

    it('remove one principal from KMS policy with multiple principals', async () => {
      const oldKMSPolicy = {
        Statement: [
          {
            Sid: 'KMS Policy',
            Effect: 'Allow',
            Principal: {
              AWS: ['arn:aws:iam::accountId1:root', 'arn:aws:iam::accountId2:root', 'arn:aws:iam::accountId3:root'],
            },
            Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
            Resource: '*',
          },
        ],
      };
      const expectedKMSPolicy = { ...oldKMSPolicy };
      expectedKMSPolicy.Statement[0].Principal.AWS = ['arn:aws:iam::accountId1:root', 'arn:aws:iam::accountId3:root'];
      AWSMock.mock('KMS', 'describeKey', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'studyKmsKeyAlias',
        });
        callback(null, { KeyMetadata: { KeyId: 'kmsStudyKeyId' } });
      });
      AWSMock.mock('KMS', 'getKeyPolicy', (params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
        });
        callback(null, { Policy: JSON.stringify(oldKMSPolicy) });
      });
      const putKeyPolicyMock = jest.fn((params, callback) => {
        expect(params).toMatchObject({
          KeyId: 'kmsStudyKeyId',
          PolicyName: 'default',
          Policy: JSON.stringify(expectedKMSPolicy),
        });
        callback(null, {});
      });
      AWSMock.mock('KMS', 'putKeyPolicy', putKeyPolicyMock);
      await environmentResourceService.removeFromKmsKeyPolicy({}, 'accountId2');
      expect(putKeyPolicyMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('allocate/deallocate idempotency', () => {
    it('ensures deallocateStudyResources can be rerun even when DB shows no usage', async () => {
      // BUILD
      const environmentScEntity = { id: 'sampleEnvId' };
      const studies = testStudiesFn();
      const memberAccountId = 'sampleAccountId';
      lockService.tryWriteLockAndRun = jest.fn((_params, callback) => callback());

      // This indicates already zero usage in DB for objects in 'studies'
      usageService.removeUsage = jest.fn(() => {
        return { items: [] };
      });

      // Tests for these are already covered earlier
      environmentResourceService.removeFromBucketPolicy = jest.fn();
      environmentResourceService.removeFromKmsKeyPolicy = jest.fn();

      // EXECUTE
      await environmentResourceService.deallocateStudyResources(
        {},
        {
          environmentScEntity,
          studies,
          memberAccountId,
        },
      );

      // CHECK
      expect(environmentResourceService.removeFromBucketPolicy).toHaveBeenCalledTimes(1);
      expect(environmentResourceService.removeFromBucketPolicy).toHaveBeenCalledWith({}, studies, memberAccountId);
      expect(environmentResourceService.removeFromKmsKeyPolicy).toHaveBeenCalledTimes(1);
      expect(environmentResourceService.removeFromKmsKeyPolicy).toHaveBeenCalledWith({}, memberAccountId);
    });

    it('ensures deallocateStudyResources can be rerun even when DB shows usage', async () => {
      // BUILD
      const environmentScEntity = { id: 'sampleEnvId' };
      const studies = testStudiesFn();
      const memberAccountId = 'sampleAccountId';
      lockService.tryWriteLockAndRun = jest.fn((_params, callback) => callback());

      // This indicates non-zero current usage in DB for objects in 'studies'
      usageService.removeUsage = jest.fn(() => {
        return { items: ['dummyUserResource1'] };
      });

      // Nothing to remove since this is currently in use
      const removeList = [];

      // Tests for these have been covered earlier
      environmentResourceService.removeFromBucketPolicy = jest.fn();
      environmentResourceService.removeFromKmsKeyPolicy = jest.fn();

      // EXECUTE
      await environmentResourceService.deallocateStudyResources(
        {},
        {
          environmentScEntity,
          studies,
          memberAccountId,
        },
      );

      // CHECK
      expect(environmentResourceService.removeFromBucketPolicy).toHaveBeenCalledTimes(1);
      expect(environmentResourceService.removeFromBucketPolicy).toHaveBeenCalledWith({}, removeList, memberAccountId);
      expect(environmentResourceService.removeFromKmsKeyPolicy).not.toHaveBeenCalled();
    });

    it('ensures allocateStudyResources can be rerun when DB shows usage', async () => {
      // BUILD
      const environmentScEntity = { id: 'sampleEnvId' };
      const studies = testStudiesFn();
      const memberAccountId = 'sampleAccountId';
      lockService.tryWriteLockAndRun = jest.fn((_params, callback) => callback());

      // This indicates first usage added in DB for objects in 'studies'
      usageService.addUsage = jest.fn(() => {
        return { items: ['dummyResourceUser1'] };
      });

      // Tests for these are already covered earlier
      environmentResourceService.addToBucketPolicy = jest.fn();
      environmentResourceService.addToKmsKeyPolicy = jest.fn();

      // EXECUTE
      await environmentResourceService.allocateStudyResources(
        {},
        {
          environmentScEntity,
          studies,
          memberAccountId,
        },
      );

      // CHECK
      expect(environmentResourceService.addToBucketPolicy).toHaveBeenCalledTimes(1);
      expect(environmentResourceService.addToBucketPolicy).toHaveBeenCalledWith({}, studies, memberAccountId);
      expect(environmentResourceService.addToKmsKeyPolicy).toHaveBeenCalledTimes(1);
      expect(environmentResourceService.addToKmsKeyPolicy).toHaveBeenCalledWith({}, memberAccountId);
    });

    it('ensures allocateStudyResources can be rerun even when DB shows no usage', async () => {
      // BUILD
      const environmentScEntity = { id: 'sampleEnvId' };
      const studies = testStudiesFn();
      const memberAccountId = 'sampleAccountId';
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

      // This indicates subsequent usage in DB for objects in 'studies'
      usageService.addUsage = jest.fn(() => {
        return { items: ['dummyResourceUser1', 'dummyResourceUser2'] };
      });

      // Tests for these are already covered earlier
      environmentResourceService.addToBucketPolicy = jest.fn();
      environmentResourceService.addToKmsKeyPolicy = jest.fn();

      // EXECUTE
      await environmentResourceService.allocateStudyResources(
        {},
        {
          environmentScEntity,
          studies,
          memberAccountId,
        },
      );

      // CHECK
      expect(environmentResourceService.addToBucketPolicy).toHaveBeenCalledTimes(1);
      expect(environmentResourceService.addToBucketPolicy).toHaveBeenCalledWith({}, studies, memberAccountId);
      expect(environmentResourceService.addToKmsKeyPolicy).toHaveBeenCalledTimes(1);
      expect(environmentResourceService.addToKmsKeyPolicy).toHaveBeenCalledWith({}, memberAccountId);
    });
  });
});
