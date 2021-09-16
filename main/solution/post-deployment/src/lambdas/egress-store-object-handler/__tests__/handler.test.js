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
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const S3Service = require('@aws-ee/base-services/lib/s3-service');
const DataEgressService = require('@aws-ee/base-raas-services/lib/data-egress/data-egress-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/s3-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-raas-services/lib/data-egress/data-egress-service');

const { handlerWithContainer } = require('../handler');

describe('handler', () => {
  let s3Service;
  let container;
  let dataEgressService;

  beforeEach(async () => {
    container = new ServicesContainer();
    container.register('settings', new SettingsServiceMock());
    container.register('s3Service', new S3Service());
    container.register('dataEgressService', new DataEgressService());
    container.register('log', new Logger());
    await container.initServices();

    s3Service = await container.find('s3Service');
    dataEgressService = await container.find('dataEgressService');
  });

  it('should trigger s3 service to put tag on object', async () => {
    // BUILD
    s3Service.putObjectTag = jest.fn();
    dataEgressService.getEgressStoreInfo = jest.fn().mockResolvedValue({ isAbleToSubmitEgressRequest: true });
    dataEgressService.enableEgressStoreSubmission = jest.fn();
    const event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'us-east-1',
          eventName: 'ObjectCreated:Put',
          userIdentity: {
            principalId: 'AWS:test:test',
          },
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'test-configurationId',
            bucket: {
              name: 'test-bucketName',
              ownerIdentity: {
                principalId: 'test-principalId',
              },
              arn: 'arn:aws:s3:::test-bucketName',
            },
            object: {
              key: encodeURIComponent('test-objectfolder/test-objectKey'),
              size: 9936,
            },
          },
        },
      ],
    };

    // EXECUTE
    await handlerWithContainer(container, event);

    // CHECK
    expect(s3Service.putObjectTag).toHaveBeenCalledTimes(1);
    expect(s3Service.putObjectTag).toHaveBeenCalledWith('test-bucketName', 'test-objectfolder/test-objectKey', {
      Key: 'egressStore',
      Value: 'test-objectfolder',
    });
  });

  it('should not trigger s3 service to put tag on folder', async () => {
    s3Service.putObjectTag = jest.fn();
    dataEgressService.getEgressStoreInfo = jest.fn().mockResolvedValue({ isAbleToSubmitEgressRequest: true });
    dataEgressService.enableEgressStoreSubmission = jest.fn();
    const event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'us-east-1',
          eventName: 'ObjectCreated:Put',
          userIdentity: {
            principalId: 'AWS:test:test',
          },
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'test-configurationId',
            bucket: {
              name: 'test-bucketName',
              ownerIdentity: {
                principalId: 'test-principalId',
              },
              arn: 'arn:aws:s3:::test-bucketName',
            },
            object: {
              key: encodeURIComponent('test-objectfolder/'),
              size: 9936,
            },
          },
        },
      ],
    };

    // EXECUTE
    await handlerWithContainer(container, event);

    // CHECK
    expect(s3Service.putObjectTag).toHaveBeenCalledTimes(0);
  });

  it('should not enable store egress submission on empty folder', async () => {
    s3Service.putObjectTag = jest.fn();
    dataEgressService.getEgressStoreInfo = jest.fn().mockResolvedValue({ isAbleToSubmitEgressRequest: false });
    dataEgressService.enableEgressStoreSubmission = jest.fn();
    const event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'us-east-1',
          eventName: 'ObjectCreated:Put',
          userIdentity: {
            principalId: 'AWS:test:test',
          },
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: 'test-configurationId',
            bucket: {
              name: 'test-bucketName',
              ownerIdentity: {
                principalId: 'test-principalId',
              },
              arn: 'arn:aws:s3:::test-bucketName',
            },
            object: {
              key: encodeURIComponent('test-objectfolder/'),
              size: 0,
            },
          },
        },
      ],
    };

    // EXECUTE
    await handlerWithContainer(container, event);

    // CHECK
    expect(dataEgressService.enableEgressStoreSubmission).toHaveBeenCalledTimes(0);
  });
});
