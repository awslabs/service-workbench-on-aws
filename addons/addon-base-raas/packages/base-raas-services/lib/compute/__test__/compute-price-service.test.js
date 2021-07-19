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
const DBServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

// jest.mock('@aws-ee/base-services/lib/json-schema-validation-service');
const JsonSchemaValidationServiceMock = require('@aws-ee/base-services/lib/json-schema-validation-service');

const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const AWSMock = require('aws-sdk-mock');

jest.mock('../compute-platform-service');
const ComputePriceService = require('../compute-price-service.js');
const ComputePlatformService = require('../compute-platform-service');

describe('ComputePlatformService', () => {
  let service;
  let aws;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DBServiceMock());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('computePriceService', new ComputePriceService());
    container.register('computePlatformService', new ComputePlatformService());
    container.register('aws', new AwsService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('computePriceService');
    aws = await service.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('ComputePriceService', () => {
    it('should calculate price info', async () => {
      // BUILD
      service._settings = {
        get: settingName => {
          if (settingName === 'awsRegion') {
            return 'test-awsRegion';
          }
          return undefined;
        },
      };
      const mockComputeConfiguration = { type: 'test-type', priceInfo: {} };

      // OPERATE
      const result = await service.calculatePriceInfo(mockComputeConfiguration);

      // CHECK
      expect(result).toEqual({ region: 'test-awsRegion' });
    });

    it('should get empty spot price history', async () => {
      // BUILD
      service._settings = {
        get: settingName => {
          if (settingName === 'awsRegion') {
            return 'test-awsRegion';
          }
          return undefined;
        },
      };

      const mockcE2Type = 'mockcE2Type';
      AWSMock.mock('EC2', 'describeSpotPriceHistory', (params, callback) => {
        expect(params).toMatchObject({
          InstanceTypes: [mockcE2Type],
          ProductDescriptions: ['Linux/UNIX'],
        });
        callback(null, { SpotPriceHistory: [] });
      });

      // OPERATE
      const result = await service.getSpotPriceHistory(mockcE2Type, 'us-east-1');

      // CHECK
      expect(result).toEqual([]);
    });

    it('should compute emr price', async () => {
      // BUILD
      service._settings = {
        get: settingName => {
          if (settingName === 'awsRegion') {
            return 'test-awsRegion';
          }
          return undefined;
        },
      };

      const mockConfiguration = {
        priceInfo: { timeUnit: 'hour', type: 'spot' },
        params: {
          immutable: {
            emr: {
              workerInstanceSize: 'test-workerInstanceSize',
              workerInstanceCount: 'test-workerInstanceCount',
              workerInstanceOnDemandPrice: 'test-workerInstanceOnDemandPrice',
              masterInstanceOnDemandPrice: 'masterInstanceOnDemandPrice',
            },
          },
        },
      };
      service.getSpotPriceHistory = jest.fn();

      // OPERATE
      const result = await service.computeEmrPrice(mockConfiguration);

      // CHECK
      expect(result).toEqual({
        region: 'test-awsRegion',
        spotBidMultiplier: undefined,
        spotBidPrice: 'test-workerInstanceOnDemandPrice',
        timeUnit: 'hour',
        type: 'spot',
        value: 'masterInstanceOnDemandPriceNaN',
      });
    });
  });
});
