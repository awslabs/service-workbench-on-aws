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
const _ = require('lodash');
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

// Mocked dependencies
jest.mock('../../../../../../addon-base/packages/services/lib/aws/aws-service');
const AwsServiceMock = require('../../../../../../addon-base/packages/services/lib/aws/aws-service');

const CreateCloudFrontInterceptor = require('../create-cloudfront-interceptor');

describe('CreateCloudFrontInterceptor', () => {
  let aws;
  let service;
  let settings;
  let loggingService;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('log', new Logger());
    container.register('settings', new SettingsServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('createCloudFrontInterceptor', new CreateCloudFrontInterceptor());
    await container.initServices();

    class MockLambda {}
    class MockCloudFront {
      constructor() {
        this.getDistributionConfig = jest.fn(() => ({
          promise: () =>
            Promise.resolve({
              ETag: 'sample-etag',
              DistributionConfig: {
                DefaultCacheBehavior: {
                  LambdaFunctionAssociations: {
                    Items: [
                      {
                        LambdaFunctionARN: 'arn:aws:lambda:us-east-1:123456789012:function:default-behavior:1',
                      },
                    ],
                  },
                },
                CacheBehaviors: {
                  Items: [
                    {
                      PathPattern: 'custom/behavior/*',
                      LambdaFunctionAssociations: {
                        Items: [
                          {
                            LambdaFunctionARN: 'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior:1',
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            }),
        }));
        this.updateDistribution = jest.fn(() => ({ promise: () => Promise.resolve() }));
      }
    }

    aws = await container.find('aws');
    aws.sdk = {
      CloudFront: MockCloudFront,
      Lambda: MockLambda,
    };
    settings = await container.find('settings');
    settings.get = jest.fn(key => key);
    loggingService = await container.find('log');
    loggingService.log = jest.fn(msg => {
      console.log(msg); // eslint-disable-line no-console
    });
    // Suppress expected messages
    jest.spyOn(console, 'info').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('createCloudFrontInterceptor');
  });

  describe('shouldPublishLambdaVersion', () => {
    describe('Should publish when no function with given ARN is yet associated with for behavior', () => {
      it('Default behavior', async () => {
        service.getLambdaCodeSha256 = jest.fn();
        const resp = await service.shouldPublishLambdaVersion('fooArnNotYetAssociated', 'default');
        expect(resp).toBe(true);
        expect(service.getLambdaCodeSha256).not.toHaveBeenCalled();
      });

      it('Custom behavior', async () => {
        service.getLambdaCodeSha256 = jest.fn();
        const resp = await service.shouldPublishLambdaVersion('fooArnNotYetAssociated', 'custom/behavior/*');
        expect(resp).toBe(true);
        expect(service.getLambdaCodeSha256).not.toHaveBeenCalled();
      });
    });

    describe('Should not publish when no function with given ARN is yet associated with behavior', () => {
      it('Default behavior', async () => {
        service.getLambdaCodeSha256 = jest.fn(async _lambdaArn => {
          // Same SHA for latest Lambda code and existing associated Lambda code
          return 'latestSha';
        });

        const resp = await service.shouldPublishLambdaVersion(
          'arn:aws:lambda:us-east-1:123456789012:function:default-behavior',
          'default',
        );
        expect(resp).toBe(false);
        expect(service.getLambdaCodeSha256).toHaveBeenCalledTimes(2);
      });

      it('Custom behavior', async () => {
        // Same SHA for latest Lambda code and existing associated Lambda code
        service.getLambdaCodeSha256 = jest.fn().mockResolvedValue('latestSha');

        const resp = await service.shouldPublishLambdaVersion(
          'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior',
          'custom/behavior/*',
        );
        expect(resp).toBe(false);
        expect(service.getLambdaCodeSha256).toHaveBeenCalledTimes(2);
      });
    });

    describe('Should publish when latest function code is not yet associated with behavior', () => {
      it('Default behavior', async () => {
        service.getLambdaCodeSha256 = jest
          .fn()
          .mockResolvedValueOnce('existingAssociatedLambdaSha')
          .mockResolvedValueOnce('latestAssociatedLambdaSha');

        const resp = await service.shouldPublishLambdaVersion(
          'arn:aws:lambda:us-east-1:123456789012:function:default-behavior',
          'default',
        );
        expect(resp).toBe(true);
        expect(service.getLambdaCodeSha256).toHaveBeenCalledTimes(2);
      });

      it('Custom behavior', async () => {
        service.getLambdaCodeSha256 = jest
          .fn()
          .mockResolvedValueOnce('existingAssociatedLambdaSha')
          .mockResolvedValueOnce('latestAssociatedLambdaSha');

        const resp = await service.shouldPublishLambdaVersion(
          'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior',
          'custom/behavior/*',
        );
        expect(resp).toBe(true);
        expect(service.getLambdaCodeSha256).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('associateLambdasWithDistribution', () => {
    describe('Should update distribution config correctly', () => {
      describe('Existing association (outdated function version)', () => {
        it('Default behavior', async () => {
          const lambdaArn = 'arn:aws:lambda:us-east-1:123456789012:function:default-behavior';
          const eventType = 'origin-response';
          const currentFunctionVersion = 1;
          const latestFunctionVersion = 2;
          const edgeLambdaConfigs = [
            {
              lambdaArn,
              behavior: 'default',
              eventType,
            },
          ];
          service.getLatestLambdaVersionNum = jest.fn().mockResolvedValue(latestFunctionVersion);

          service.cloudFrontConfig = {
            ETag: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {
                LambdaFunctionAssociations: {
                  Quantity: 1,
                  Items: [
                    {
                      EventType: eventType,
                      LambdaFunctionARN: `${lambdaArn}:${currentFunctionVersion}`,
                    },
                  ],
                },
              },
            },
          };

          const expectedConfig = {
            Id: 'cloudFrontId',
            IfMatch: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {
                LambdaFunctionAssociations: {
                  Quantity: 1,
                  Items: [
                    {
                      EventType: eventType,
                      LambdaFunctionARN: `${lambdaArn}:${latestFunctionVersion}`,
                    },
                  ],
                },
              },
            },
          };

          await service.associateLambdasWithDistribution(edgeLambdaConfigs);
          expect(service.cloudFrontApi.updateDistribution).toHaveBeenCalledWith(expectedConfig);
        });

        it('Custom behavior', async () => {
          const lambdaArn = 'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior';
          const eventType = 'origin-response';
          const currentFunctionVersion = 1;
          const latestFunctionVersion = 2;
          const edgeLambdaConfigs = [
            {
              lambdaArn,
              behavior: 'custom/behavior/*',
              eventType,
            },
          ];
          service.getLatestLambdaVersionNum = jest.fn().mockResolvedValue(latestFunctionVersion);

          service.cloudFrontConfig = {
            ETag: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {},
              CacheBehaviors: {
                Items: [
                  {
                    PathPattern: 'custom/behavior/*',
                    LambdaFunctionAssociations: {
                      Quantity: 1,
                      Items: [
                        {
                          EventType: eventType,
                          LambdaFunctionARN: `${lambdaArn}:${currentFunctionVersion}`,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          };

          const expectedConfig = {
            Id: 'cloudFrontId',
            IfMatch: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {},
              CacheBehaviors: {
                Items: [
                  {
                    PathPattern: 'custom/behavior/*',
                    LambdaFunctionAssociations: {
                      Quantity: 1,
                      Items: [
                        {
                          EventType: eventType,
                          LambdaFunctionARN: `${lambdaArn}:${latestFunctionVersion}`,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          };

          await service.associateLambdasWithDistribution(edgeLambdaConfigs);
          expect(service.cloudFrontApi.updateDistribution).toHaveBeenCalledWith(expectedConfig);
        });
      });

      describe('No existing association', () => {
        it('Default behavior', async () => {
          const lambdaArn = 'arn:aws:lambda:us-east-1:123456789012:function:default-behavior';
          const eventType = 'origin-response';
          const latestFunctionVersion = 2;
          const edgeLambdaConfigs = [
            {
              lambdaArn,
              behavior: 'default',
              eventType,
            },
          ];
          service.getLatestLambdaVersionNum = jest.fn().mockResolvedValue(latestFunctionVersion);

          service.cloudFrontConfig = {
            ETag: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {},
            },
          };

          const expectedConfig = {
            Id: 'cloudFrontId',
            IfMatch: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {
                LambdaFunctionAssociations: {
                  Quantity: 1,
                  Items: [
                    {
                      EventType: eventType,
                      LambdaFunctionARN: `${lambdaArn}:${latestFunctionVersion}`,
                    },
                  ],
                },
              },
            },
          };

          await service.associateLambdasWithDistribution(edgeLambdaConfigs);
          expect(service.cloudFrontApi.updateDistribution).toHaveBeenCalledWith(expectedConfig);
        });

        it('Custom behavior', async () => {
          const lambdaArn = 'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior';
          const eventType = 'origin-response';
          const latestFunctionVersion = 2;
          const edgeLambdaConfigs = [
            {
              lambdaArn,
              behavior: 'custom/behavior/*',
              eventType,
            },
          ];
          service.getLatestLambdaVersionNum = jest.fn().mockResolvedValue(latestFunctionVersion);

          service.cloudFrontConfig = {
            ETag: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {},
              CacheBehaviors: {
                Items: [
                  {
                    PathPattern: 'custom/behavior/*',
                  },
                ],
              },
            },
          };

          const expectedConfig = {
            Id: 'cloudFrontId',
            IfMatch: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {},
              CacheBehaviors: {
                Items: [
                  {
                    PathPattern: 'custom/behavior/*',
                    LambdaFunctionAssociations: {
                      Quantity: 1,
                      Items: [
                        {
                          EventType: eventType,
                          LambdaFunctionARN: `${lambdaArn}:${latestFunctionVersion}`,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          };

          await service.associateLambdasWithDistribution(edgeLambdaConfigs);
          expect(service.cloudFrontApi.updateDistribution).toHaveBeenCalledWith(expectedConfig);
        });

        it('Mixed (default and custom)', async () => {
          const lambdaConfigs = {
            defaultLambda1: {
              lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:default-behavior1',
              behavior: 'default',
              eventType: 'origin-request',
            },
            defaultLambda2: {
              lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:default-behavior2',
              behavior: 'default',
              eventType: 'origin-response',
            },
            customLambdaBehavior1Lambda1: {
              lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior1-a',
              behavior: 'custom/behavior1/*',
              eventType: 'origin-response',
            },
            customLambdaBehavior1Lambda2: {
              lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior1-b',
              behavior: 'custom/behavior1/*',
              eventType: 'origin-response',
            },
            customLambdaBehavior2: {
              lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:custom-behavior2',
              behavior: 'custom/behavior2/index.html',
              eventType: 'viewer-request',
            },
          };

          const latestFunctionVersion = 2;
          service.getLatestLambdaVersionNum = jest.fn().mockResolvedValue(latestFunctionVersion);

          service.cloudFrontConfig = {
            ETag: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {},
              CacheBehaviors: {
                Items: [
                  {
                    PathPattern: lambdaConfigs.customLambdaBehavior1Lambda1.behavior,
                  },
                  {
                    PathPattern: lambdaConfigs.customLambdaBehavior2.behavior,
                  },
                ],
              },
            },
          };

          const expectedConfig = {
            Id: 'cloudFrontId',
            IfMatch: 'sample-etag',
            DistributionConfig: {
              DefaultCacheBehavior: {
                LambdaFunctionAssociations: {
                  Quantity: 2,
                  Items: [
                    {
                      EventType: lambdaConfigs.defaultLambda1.eventType,
                      LambdaFunctionARN: `${lambdaConfigs.defaultLambda1.lambdaArn}:${latestFunctionVersion}`,
                    },
                    {
                      EventType: lambdaConfigs.defaultLambda2.eventType,
                      LambdaFunctionARN: `${lambdaConfigs.defaultLambda2.lambdaArn}:${latestFunctionVersion}`,
                    },
                  ],
                },
              },
              CacheBehaviors: {
                Items: [
                  {
                    PathPattern: lambdaConfigs.customLambdaBehavior1Lambda1.behavior,
                    LambdaFunctionAssociations: {
                      Quantity: 2,
                      Items: [
                        {
                          EventType: lambdaConfigs.customLambdaBehavior1Lambda1.eventType,
                          LambdaFunctionARN: `${lambdaConfigs.customLambdaBehavior1Lambda1.lambdaArn}:${latestFunctionVersion}`,
                        },
                        {
                          EventType: lambdaConfigs.customLambdaBehavior1Lambda2.eventType,
                          LambdaFunctionARN: `${lambdaConfigs.customLambdaBehavior1Lambda2.lambdaArn}:${latestFunctionVersion}`,
                        },
                      ],
                    },
                  },
                  {
                    PathPattern: lambdaConfigs.customLambdaBehavior2.behavior,
                    LambdaFunctionAssociations: {
                      Quantity: 1,
                      Items: [
                        {
                          EventType: lambdaConfigs.customLambdaBehavior2.eventType,
                          LambdaFunctionARN: `${lambdaConfigs.customLambdaBehavior2.lambdaArn}:${latestFunctionVersion}`,
                        },
                      ],
                    },
                  },
                ],
              },
            },
          };

          const edgeLambdaConfigs = _.toArray(lambdaConfigs);
          await service.associateLambdasWithDistribution(edgeLambdaConfigs);
          expect(service.cloudFrontApi.updateDistribution).toHaveBeenCalledWith(expectedConfig);
        });
      });
    });
  });

  describe('getLatestLambdaVersionNum', () => {
    it('Return 1 with only one version', async () => {
      service.lambdaApi.listVersionsByFunction = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            Versions: [
              {
                Version: '$LATEST',
              },
            ],
          }),
      }));

      const resp = await service.getLatestLambdaVersionNum('foo');
      expect(resp).toEqual(1);
    });

    it('Return latest (one before "$LATEST") version if multiple versions', async () => {
      service.lambdaApi.listVersionsByFunction = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            Versions: [
              {
                Version: '$LATEST',
              },
              {
                Version: '2',
              },
              {
                Version: '1',
              },
            ],
          }),
      }));

      const resp = await service.getLatestLambdaVersionNum('foo');
      expect(resp).toEqual(2);
    });
  });

  describe('execute', () => {
    it('Should update CloudFront Distribution if at least one Lambda was published', async () => {
      service.shouldPublishLambdaVersion = jest
        .fn()
        .mockResolvedValue(false)
        .mockResolvedValueOnce(true);
      service.publishNewLambdaVersion = jest.fn();
      service.associateLambdasWithDistribution = jest.fn();

      await service.execute();
      expect(service.associateLambdasWithDistribution).toHaveBeenCalled();
    });

    it('Should skip updating CloudFront Distribution if no Lambdas published', async () => {
      service.shouldPublishLambdaVersion = jest.fn().mockResolvedValue(false);
      service.publishNewLambdaVersion = jest.fn();
      service.associateLambdasWithDistribution = jest.fn();

      await service.execute();
      expect(service.associateLambdasWithDistribution).not.toHaveBeenCalled();
    });
  });
});
