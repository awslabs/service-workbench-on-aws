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
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

const UpdateCfnStackPolicy = require('../update-cfn-stack-policy');
const CloudFormation = require('./__fixtures__/cloudformation');
const registerSettings = require('./__fixtures__/settings');

describe('UpgradeToUserId', () => {
  let service;
  let aws;
  let container;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    await registerSettings(container);
    container.register('log', new Logger());
    container.register('aws', new AwsServiceMock());
    container.register('UpdateCfnStackPolicy', new UpdateCfnStackPolicy());
    console.info = jest.fn;

    await container.initServices();
    aws = await container.find('aws');
    aws.sdk = {
      CloudFormation,
    };
    service = await container.find('UpdateCfnStackPolicy');
    service._settings = {
      get: settingName => {
        if (settingName === 'enableEgressStore') {
          return 'true';
        }
        if (settingName === 'backendStackName') {
          return 'backendStackName';
        }
        return undefined;
      },
    };
  });

  describe('Run post deployment step', () => {
    it('should successful update policy without stack policy', async () => {
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody:
          '{"Statement":[{"Effect":"Allow","Action":"Update:*","Principal":"*","Resource":"*"},{"Effect":"Deny","Action":"Update:Delete","Principal":"*","Resource":"LogicalResourceId/EgressStore*"}]}',
      });
    });
    it('should successful update policy with empty stack policy', async () => {
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: '{}',
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));
      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody:
          '{"Statement":[{"Effect":"Allow","Action":"Update:*","Principal":"*","Resource":"*"},{"Effect":"Deny","Action":"Update:Delete","Principal":"*","Resource":"LogicalResourceId/EgressStore*"}]}',
      });
    });

    it('should successful update policy with existing statement', async () => {
      service.cfn.getStackPolicy = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            StackPolicyBody: JSON.stringify({
              Effect: 'Allow',
              Action: 'Update:*',
              Principal: '*',
              Resource: '*',
            }),
          }),
      }));
      service.cfn.setStackPolicy = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));

      await service.execute();
      expect(service.cfn.getStackPolicy).toHaveBeenCalledTimes(1);
      expect(service.cfn.setStackPolicy).toHaveBeenCalledWith({
        StackName: 'backendStackName',
        StackPolicyBody:
          '{"Statement":[{"Effect":"Allow","Action":"Update:*","Principal":"*","Resource":"*"},{"Effect":"Deny","Action":"Update:Delete","Principal":"*","Resource":"LogicalResourceId/EgressStore*"}]}',
      });
    });
  });
});
