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
const ServicesContainer = require('@amzn/base-services-container/lib/services-container');
const Logger = require('@amzn/base-services/lib/logger/logger-service');

jest.mock('@amzn/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@amzn/base-services/lib/aws/aws-service');

jest.mock('@amzn/base-services/lib/db-service');
const DbServiceMock = require('@amzn/base-services/lib/db-service');

jest.mock('@amzn/base-post-deployment/lib/deployment-store-service');
const DeploymentStoreServiceMock = require('@amzn/base-post-deployment/lib/deployment-store-service');

const UpgradeToUserId = require('../upgrade-to-user-id');
const DynamoDB = require('./__fixtures__/dynamodb');
const registerSettings = require('./__fixtures__/settings');

jest.mock('../../utils/scan');
const Scan = require('../../utils/scan');

jest.mock('../../data/tables');

describe('UpgradeToUserId', () => {
  let service;
  let aws;
  let container;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    await registerSettings(container);
    container.register('log', new Logger());
    container.register('deploymentStoreService', new DeploymentStoreServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('UpgradeToUserId', new UpgradeToUserId());
    console.info = jest.fn;

    await container.initServices();
    aws = await container.find('aws');
    aws.sdk = {
      DynamoDB,
    };
    service = await container.find('UpgradeToUserId');
  });

  describe('Run post deployment step', () => {
    it('should skip upgrade if no users in the old users table', async () => {
      service.api.getItem = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            Item: [],
          }),
      }));
      await service.execute();
      expect(service.api.getItem).toHaveBeenCalledTimes(1);
    });
    it('should skip upgrade if a successful upgrade was completed previously', async () => {
      service.api.getItem = jest.fn(() => ({
        promise: () =>
          Promise.resolve({
            Item: [{ username: 'root' }],
          }),
      }));
      service.findDeploymentItem = jest.fn().mockResolvedValue('completed');
      await service.execute();
      expect(service.api.getItem).toHaveBeenCalledTimes(1);
      expect(service.findDeploymentItem).toHaveBeenCalledTimes(1);
    });
    it('should skip migration of old users table if a successful migration of this table was completed previously', async () => {
      // The difference between this and the test in line 73 is that, this test is about verifying that we correctly
      // skip the migration of the user users table if we already marked this specific table as being migrated.
      service.api.getItem = jest.fn().mockImplementationOnce(() => ({
        promise: () =>
          Promise.resolve({
            Item: [{ username: 'root' }],
          }),
      }));
      Scan.prototype.all = jest.fn().mockResolvedValue({ Items: [] });
      service.findDeploymentItem = jest
        .fn()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce('completed');
      await service.execute();
      expect(service.api.getItem).toHaveBeenCalledTimes(1);
      expect(service.findDeploymentItem).toHaveBeenCalledTimes(2);
    });
  });
});
