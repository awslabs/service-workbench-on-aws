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

const ServicesContainer = require('@amzn/base-services-container/lib/services-container');

// Mocked dependencies
jest.mock('@amzn/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');

const Aws = require('@amzn/base-services/lib/aws/aws-service');
const Logger = require('@amzn/base-services/lib/logger/logger-service');

const EnvironmentAmiService = require('../environment-ami-service');

describe('EnvironmentAmiService', () => {
  let service = null;
  let aws = null;

  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('settings', new SettingsServiceMock());
    container.register('environmentAmiService', new EnvironmentAmiService());
    container.register('log', new Logger());
    container.register('aws', new Aws());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentAmiService');
    aws = await container.find('aws');
    aws.getClientSdkForRole = jest.fn();
    service.checkIfAmiSharingEnabled = jest.fn(() => {
      return false;
    });
  });

  describe('Test getEc2Sdk', () => {
    it('should call getDevopsAccountDetails when AMI sharing is enabled', async () => {
      service.checkIfAmiSharingEnabled = jest.fn(() => {
        return true;
      });
      service.getDevopsAccountDetails = jest.fn(() => {
        return {
          roleArn: 'Test_ARN',
          externalId: 'Test_ID',
        };
      });
      await service.getEc2Sdk();
      expect(service.getDevopsAccountDetails).toHaveBeenCalled();
    });

    it('should not call getDevopsAccountDetails when AMI sharing is disabled', async () => {
      service.checkIfAmiSharingEnabled = jest.fn(() => {
        return false;
      });
      service.getDevopsAccountDetails = jest.fn(() => {
        return {
          roleArn: 'Test_ARN',
          externalId: 'Test_ID',
        };
      });
      await service.getEc2Sdk();
      expect(service.getDevopsAccountDetails).not.toHaveBeenCalled();
    });
  });
});
