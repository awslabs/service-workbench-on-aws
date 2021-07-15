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
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');

const AWSMock = require('aws-sdk-mock');

jest.mock('@aws-ee/base-raas-services/lib/aws-accounts/aws-accounts-service');
const AwsAccountsServiceMock = require('@aws-ee/base-raas-services/lib/aws-accounts/aws-accounts-service');

jest.mock('@aws-ee/base-raas-services/lib/indexes/indexes-service');
const IndexesServiceMock = require('@aws-ee/base-raas-services/lib/indexes/indexes-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-keypair-service');
const EnvironmentScKeyPairServiceMock = require('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-keypair-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/logger/logger-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

const AppStreamScService = require('../appstream-sc-service');

describe('AppStreamScService', () => {
  let service = null;
  let environmentScService = null;

  beforeAll(async () => {
    const container = new ServicesContainer();
    container.register('log', new Logger());
    container.register('aws', new AwsService());
    container.register('settings', new SettingsServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('environmentScKeypairService', new EnvironmentScKeyPairServiceMock());
    container.register('appStreamScService', new AppStreamScService());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('indexesService', new IndexesServiceMock());
    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('appStreamScService');
    environmentScService = await container.find('environmentScService');
  });

  beforeEach(async () => {
    const aws = await service.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('urlForRemoteDesktop', () => {
    it('should return AppStream url for environment', async () => {
      // BUILD
      const params = {
        environmentId: 'env1',
        instanceId: 'instance1',
      };
      const requestContext = { principalIdentifier: { uid: 'u-testuser' } };
      const ec2Mock = {};
      ec2Mock.describeInstances = jest.fn(() => {
        return {
          promise: () => {
            return {
              Reservations: [
                {
                  Instances: [
                    {
                      NetworkInterfaces: [
                        {
                          PrivateIpAddress: '10.0.78.193',
                        },
                      ],
                    },
                  ],
                },
              ],
            };
          },
        };
      });
      const appStreamMock = {
        createStreamingURL: jest.fn(() => {
          return {
            promise: () => {
              return {
                StreamingURL: 'testurl',
              };
            },
          };
        }),
      };
      environmentScService.mustFind = jest.fn(() => {
        return { indexId: 'exampleIndexId', createdAt: '2021-07-14T03:33:21.234Z' };
      });
      service.getStackAndFleet = jest.fn(() => {
        return { stackName: 'testStack', fleetName: 'testFleet' };
      });
      environmentScService.getClientSdkWithEnvMgmtRole = jest.fn((context, envId, client) => {
        if (client.clientName === 'EC2') {
          return ec2Mock;
        }
        if (client.clientName === 'AppStream') {
          return appStreamMock;
        }
        throw Error('unexpected clientName');
      });

      // OPERATE
      const returnedUrl = await service.urlForRemoteDesktop(requestContext, params);

      // ASSERT
      expect(returnedUrl).toEqual('testurl');
      expect(environmentScService.mustFind).toHaveBeenCalledWith(requestContext, { id: 'env1' });
      expect(service.getStackAndFleet).toHaveBeenCalledWith(requestContext, {
        environmentId: 'env1',
        indexId: 'exampleIndexId',
      });
      expect(ec2Mock.describeInstances).toHaveBeenCalledTimes(1);
      expect(ec2Mock.describeInstances).toHaveBeenCalledWith({ InstanceIds: ['instance1'] });
      expect(appStreamMock.createStreamingURL).toHaveBeenCalledTimes(1);
      expect(appStreamMock.createStreamingURL).toHaveBeenCalledWith({
        FleetName: 'testFleet',
        StackName: 'testStack',
        UserId: 'u-testuser-2xhxhu',
        ApplicationId: 'MicrosoftRemoteDesktop',
        SessionContext: '10.0.78.193',
      });
    });
  });
});
