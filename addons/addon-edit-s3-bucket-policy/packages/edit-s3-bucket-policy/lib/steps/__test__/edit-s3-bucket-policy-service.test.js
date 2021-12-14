/* eslint-disable no-console */
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

/* eslint-disable max-classes-per-file */
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/s3-service');
const S3ServiceMock = require('@aws-ee/base-services/lib/s3-service');

const EditS3BucketPolicyService = require('../edit-s3-bucket-policy-service');
const registerSettings = require('./__fixtures__/settings');

describe('EditS3BucketPolicyService', () => {
  let service;
  let lockService;
  let container;
  let settings;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    await registerSettings(container);
    container.register('log', new Logger());
    container.register('lockService', new LockServiceMock());
    container.register('s3Service', new S3ServiceMock());
    container.register('EditS3BucketPolicyService', new EditS3BucketPolicyService());
    container.register('settings', new SettingsServiceMock());
    console.info = jest.fn;

    await container.initServices();
    lockService = await container.find('lockService');
    service = await container.find('EditS3BucketPolicyService');
    settings = await container.find('settings');
    settings.get = jest.fn(key => {
      if (key === 'environmentsBootstrapBucketName') {
        return 'environmentsBootstrapBucketName';
      }
      if (key === 'studyDataBucketName') {
        return 'studyDataBucketName';
      }
      if (key === 'deploymentBucketName') {
        return 'deploymentBucketName';
      }
      return undefined;
    });
  });

  describe('Run post deployment step', () => {
    const s3Client = {};
    s3Client.putBucketPolicy = jest.fn(() => {
      return { promise: jest.fn() };
    });
    const tlsStatement = 'Deny requests that do not use TLS';
    const newStatement = 'Deny requests that do not use TLS/HTTPS';
    const replacePattern = 'HTTPS';
    const bucketName = 'somebucket';

    it('should do nothing when bucket does not have a policy attached', async () => {
      // BUILD
      s3Client.getBucketPolicy = jest.fn(() => {
        return {
          promise: () => {
            return Promise.resolve({ Policy: JSON.stringify({}) });
          },
        };
      });
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());
      service.s3Client = s3Client;

      // OPERATE
      await service.replaceS3BucketPolicyStatement(bucketName, tlsStatement, newStatement, replacePattern);

      // CHECK
      expect(s3Client.putBucketPolicy).not.toHaveBeenCalled();
    });

    it('should do nothing when bucket policy does not have TLS statement', async () => {
      // BUILD
      const s3Policy = {
        Statement: [
          {
            Sid: 'Something',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: 'somebucket',
          },
        ],
      };
      s3Client.getBucketPolicy = jest.fn(() => {
        return {
          promise: () => {
            return Promise.resolve({
              Policy: JSON.stringify(s3Policy),
            });
          },
        };
      });
      service.s3Client = s3Client;
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

      // OPERATE
      await service.replaceS3BucketPolicyStatement(bucketName, tlsStatement, newStatement, replacePattern);

      // CHECK
      expect(s3Client.putBucketPolicy).not.toHaveBeenCalled();
    });

    it('should replace TLS statement in bucket policy', async () => {
      // BUILD
      const oldS3Policy = {
        Statement: [
          {
            Sid: 'Deny requests that do not use TLS',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: 'somebucket/*',
          },
        ],
      };
      const newS3Policy = {
        Statement: [
          {
            Sid: 'Deny requests that do not use TLS/HTTPS',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: ['somebucket/*', 'somebucket'],
          },
        ],
      };
      s3Client.getBucketPolicy = jest.fn(() => {
        return {
          promise: () => {
            return Promise.resolve({
              Policy: JSON.stringify(oldS3Policy),
            });
          },
        };
      });
      service.s3Client = s3Client;
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

      // OPERATE
      await service.replaceS3BucketPolicyStatement(bucketName, tlsStatement, newStatement, replacePattern);

      // CHECK
      expect(s3Client.putBucketPolicy).toHaveBeenCalledWith({
        Bucket: bucketName,
        Policy: JSON.stringify(newS3Policy),
      });
    });

    it('should replace TLS statement in complex bucket policy', async () => {
      // BUILD
      const oldS3Policy = {
        Statement: [
          {
            Sid: 'Super important permission to get to bucket during workspace launch',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: ['somebucket/*', 'somebucket'],
          },
          {
            Sid: 'Super important permission to get to study data from workspace ',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: ['somebucket/*', 'somebucket'],
          },
          {
            Sid: 'Deny requests that do not use TLS',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: 'somebucket/*',
          },
        ],
      };
      const newS3Policy = {
        Statement: [
          {
            Sid: 'Super important permission to get to bucket during workspace launch',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: ['somebucket/*', 'somebucket'],
          },
          {
            Sid: 'Super important permission to get to study data from workspace ',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: ['somebucket/*', 'somebucket'],
          },
          {
            Sid: 'Deny requests that do not use TLS/HTTPS',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: ['somebucket/*', 'somebucket'],
          },
        ],
      };
      s3Client.getBucketPolicy = jest.fn(() => {
        return {
          promise: () => {
            return Promise.resolve({
              Policy: JSON.stringify(oldS3Policy),
            });
          },
        };
      });
      service.s3Client = s3Client;
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

      // OPERATE
      await service.replaceS3BucketPolicyStatement(bucketName, tlsStatement, newStatement, replacePattern);

      // CHECK
      expect(s3Client.putBucketPolicy).toHaveBeenCalledWith({
        Bucket: bucketName,
        Policy: JSON.stringify(newS3Policy),
      });
    });
  });
});
