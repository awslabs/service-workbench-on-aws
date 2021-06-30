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
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const AWSMock = require('aws-sdk-mock');
const S3Service = require('../s3-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');

describe('S3Service', () => {
  let s3Service;
  let container;
  let aws;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    container.register('aws', new AwsService());
    container.register('s3Service', new S3Service());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();
    s3Service = await container.find('s3Service');
    aws = await s3Service.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });
  describe('S3Service', () => {
    it('should parse in s3 bucket detail', async () => {
      const result = await s3Service.parseS3Details('s3://test-bucket/test-prefix');
      expect(result).toStrictEqual({ s3BucketName: 'test-bucket', s3Key: 'test-prefix' });
    });
    it('should move object from one place to another', async () => {
      const from = { bucket: 'test-from-bucket', key: 'test-from-key' };
      const to = { bucket: 'test-to-bucket', key: 'test-to-key' };
      AWSMock.mock('S3', 'copyObject', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: to.bucket,
          CopySource: `/${from.bucket}/${from.key}`,
          Key: `${to.key}`,
        });
      });

      AWSMock.mock('S3', 'deleteObject', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: from.bucket,
          Key: `${from.key}`,
        });
      });
      s3Service.moveObject({ from, to });
    });
    it('should clear s3 object in certain s3 bucket path', async () => {
      AWSMock.mock('S3', 'listObjectsV2', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-bucketName',
          Prefix: 'test-dir',
        });
        callback(null, {
          Prefix: [{ key: 'test-key1' }, { key: 'test-key2' }],
        });
      });

      AWSMock.mock('S3', 'deleteObjects', (params, callback) => {
        expect(params).toMatchObject({
          Bucket: 'test-bucketName',
          Delete: { Objects: [{ key: 'test-key1' }, { key: 'test-key2' }] },
        });
      });
      s3Service.clearPath('test-bucketName', 'test-dir');
    });
  });
});
