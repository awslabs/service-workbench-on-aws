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

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

const UpdateCfnStackPolicy = require('../update-cfn-stack-policy');
const CloudFormation = require('./__fixtures__/cloudformation');
const registerSettings = require('./__fixtures__/settings');

describe('UpdateCfnStackPolicy', () => {
  let service;
  let aws;
  let container;
  let settings;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    await registerSettings(container);
    container.register('log', new Logger());
    container.register('aws', new AwsServiceMock());
    container.register('UpdateCfnStackPolicy', new UpdateCfnStackPolicy());
    container.register('settings', new SettingsServiceMock());
    console.info = jest.fn;

    await container.initServices();
    aws = await container.find('aws');
    aws.sdk = {
      CloudFormation,
    };
    service = await container.find('UpdateCfnStackPolicy');
    settings = await container.find('settings');
    settings.get = jest.fn(key => {
      if (key === 'backendStackName') {
        return 'backendStackName';
      }
      return undefined;
    });
    settings.getBoolean = jest.fn(key => {
      if (key === 'enableEgressStore') {
        return true;
      }
      if (key === 'isAppStreamEnabled') {
        return true;
      }
      return undefined;
    });
  });

  describe('Run post deployment step', () => {
    it('should successfully update policy when old stack policy does not exist', async () => {
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      const expected = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };
      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody: JSON.stringify(expected),
      });
    });

    it('should successfully update policy when old stack policy is empty', async () => {
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: '{}',
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      const expected = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };
      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody: JSON.stringify(expected),
      });
    });

    it('should successfully update policy when old stack policy is not empty', async () => {
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: JSON.stringify({
              Statement: [
                {
                  Effect: 'Allow',
                  Action: 'Update:*',
                  Principal: '*',
                  Resource: '*',
                },
              ],
            }),
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      const expected = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };

      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody: JSON.stringify(expected),
      });
    });

    it('should successfully update policy when appstream is enabled after egress', async () => {
      const originalPolicy = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
        ],
      };
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: JSON.stringify(originalPolicy),
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      const expected = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };

      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody: JSON.stringify(expected),
      });
    });

    it('should successfully update policy when egress is enabled after appstream', async () => {
      const originalPolicy = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: JSON.stringify(originalPolicy),
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      const expected = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
        ],
      };

      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody: JSON.stringify(expected),
      });
    });

    it('should not update policy when no new changes are made', async () => {
      const originalPolicy = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: JSON.stringify(originalPolicy),
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));

      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).not.toHaveBeenCalled();
    });

    it('should not update policy when AppStream was disabled, but both features were previously enabled', async () => {
      const originalPolicy = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };
      settings.get = jest.fn(key => {
        if (key === 'backendStackName') {
          return 'backendStackName';
        }
        return undefined;
      });
      settings.getBoolean = jest.fn(key => {
        if (key === 'enableEgressStore') {
          return true;
        }
        if (key === 'isAppStreamEnabled') {
          return false;
        }
        return undefined;
      });
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: JSON.stringify(originalPolicy),
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));

      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).not.toHaveBeenCalled();
    });

    it('should not update policy when Egress was disabled, but both features were previously enabled', async () => {
      const originalPolicy = {
        Statement: [
          {
            Effect: 'Allow',
            Action: 'Update:*',
            Principal: '*',
            Resource: '*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/EgressStore*',
          },
          {
            Effect: 'Deny',
            Action: 'Update:Delete',
            Principal: '*',
            Resource: 'LogicalResourceId/AppStream*',
          },
        ],
      };
      settings.get = jest.fn(key => {
        if (key === 'backendStackName') {
          return 'backendStackName';
        }
        return undefined;
      });
      settings.getBoolean = jest.fn(key => {
        if (key === 'enableEgressStore') {
          return false;
        }
        if (key === 'isAppStreamEnabled') {
          return true;
        }
        return undefined;
      });
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: JSON.stringify(originalPolicy),
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));

      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).not.toHaveBeenCalled();
    });

    it('should not update policy when Egress was disabled, but it was previously enabled', async () => {
      settings.get = jest.fn(key => {
        if (key === 'backendStackName') {
          return 'backendStackName';
        }
        return undefined;
      });
      settings.getBoolean = jest.fn(key => {
        if (key === 'enableEgressStore') {
          return false;
        }
        if (key === 'isAppStreamEnabled') {
          return false;
        }
        return undefined;
      });
      service.cfn.getStackPolicy = jest.fn();
      service.cfn.setStackPolicy = jest.fn();

      await service.execute();
      expect(service.cfn.getStackPolicy).not.toHaveBeenCalled();
      expect(service.cfn.setStackPolicy).not.toHaveBeenCalled();
    });

    it('should not update policy when AppStream was disabled, but it was previously enabled', async () => {
      settings.get = jest.fn(key => {
        if (key === 'backendStackName') {
          return 'backendStackName';
        }
        return undefined;
      });
      settings.getBoolean = jest.fn(key => {
        if (key === 'enableEgressStore') {
          return false;
        }
        if (key === 'isAppStreamEnabled') {
          return false;
        }
        return undefined;
      });
      service.cfn.getStackPolicy = jest.fn();
      service.cfn.setStackPolicy = jest.fn();

      await service.execute();
      expect(service.cfn.getStackPolicy).not.toHaveBeenCalled();
      expect(service.cfn.setStackPolicy).not.toHaveBeenCalled();
    });
  });
});
