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

// Mocked services
jest.mock('@amzn/base-services/lib/aws/aws-service');
const AWSMock = require('@amzn/base-services/lib/aws/aws-service');

jest.mock('@amzn/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@amzn/base-services/lib/authorization/authorization-service');

jest.mock('../../aws-accounts/aws-accounts-service');
const AWSAccountsServiceMock = require('../../aws-accounts/aws-accounts-service');

jest.mock('../../environment/built-in/environment-service');
const EnvironmentServiceMock = require('../../environment/built-in/environment-service');

jest.mock('../../environment/service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('../../environment/service-catalog/environment-sc-service');

jest.mock('../../indexes/indexes-service');
const IndexesServiceMock = require('../../indexes/indexes-service');

jest.mock('../../cost-api-cache/cost-api-cache-service');
const CostAPICacheServiceMock = require('../../cost-api-cache/cost-api-cache-service');

const CostsService = require('../costs-service');

describe('CostsService', () => {
  let service;
  let costCacheService;

  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('aws', new AWSMock());
    container.register('awsAccountsService', new AWSAccountsServiceMock());
    container.register('environmentService', new EnvironmentServiceMock());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('indexesService', new IndexesServiceMock());
    container.register('costApiCacheService', new CostAPICacheServiceMock());
    container.register('authorizationService', new AuthServiceMock());

    container.register('costsService', new CostsService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('costsService');
    costCacheService = await container.find('costApiCacheService');
  });

  describe('getIndividualEnvironmentOrProjCost', () => {
    it('should return warning message when using all three groupBy', async () => {
      // BUILD
      const query = {
        env: {},
        proj: {},
        groupByUser: 'true',
        groupByEnv: 'true',
        groupByService: 'true',
        numberOfDaysInPst: 0,
      };

      // OPERATE
      const response = await service.getIndividualEnvironmentOrProjCost({}, query);

      // CHECK
      expect(response).toMatch(
        'Can not groupByUser, groupByEnv, and groupByService. Please pick at most 2 out of the 3.',
      );
    });

    it('should return cache data when cache elapse is less then 12 ', async () => {
      // BUILD
      const query = {
        env: {},
        proj: {},
        groupByUser: 'true',
        groupByEnv: 'true',
        groupByService: 'false',
        numberOfDaysInPst: 0,
      };

      const UPDATEDAT = new Date().toISOString();
      const cacheResponse = { updatedAt: UPDATEDAT, result: '{"result":true, "count":42}' };
      costCacheService.find = jest.fn().mockResolvedValue(cacheResponse);

      // OPERATE
      const response = await service.getIndividualEnvironmentOrProjCost({}, query);

      // CHECK
      expect(response).toMatchObject({ result: true, count: 42 });
    });

    it('should call cost explorer API with correct parameters when cache does not exist ', async () => {
      // BUILD
      const query = {
        env: {},
        proj: 1234,
        groupByUser: 'true',
        groupByEnv: 'true',
        groupByService: 'false',
        numberOfDaysInPst: 0,
      };

      costCacheService.find = jest.fn();
      service.callAwsCostExplorerApi = jest.fn();

      // OPERATE
      await service.getIndividualEnvironmentOrProjCost({}, query);

      // CHECK
      expect(service.callAwsCostExplorerApi).toHaveBeenCalledWith(
        {},
        1234,
        undefined,
        { Tags: { Key: 'Proj', Values: [1234] } },
        [
          { Key: 'CreatedBy', Type: 'TAG' },
          { Key: 'Env', Type: 'TAG' },
        ],
      );
    });
  });
});
