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
jest.mock('@amzn/base-services/lib/db-service');
const DBServiceMock = require('@amzn/base-services/lib/db-service');

jest.mock('@amzn/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');

// jest.mock('@amzn/base-services/lib/json-schema-validation-service');
const JsonSchemaValidationServiceMock = require('@amzn/base-services/lib/json-schema-validation-service');

const CostCacheService = require('../cost-api-cache-service');

describe('CostCacheService', () => {
  let service;
  let dbService;
  const QUERY =
    '{"env":"9fc8dd70-bb15-11ea-8cdd-9932b28d6f3e","numberOfDaysInPast":"1","groupByService":"true","groupByUser":"false"}';
  const RESULT = '[{"startDate":"2020-06-29","cost":{"Amazon SageMaker":{"amount":1.14,"unit":"USD"}}}]';
  const INDEX_ID = 'SecondIndex';

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DBServiceMock());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationServiceMock());
    container.register('settings', new SettingsServiceMock());

    container.register('costCacheService', new CostCacheService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('costCacheService');

    // Get the service we need to spy input on
    dbService = await container.find('dbService');
  });

  describe('create', () => {
    it('should call DBService with correct input', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const rawData = { indexId: INDEX_ID, query: QUERY, result: RESULT };

      // OPERATE
      await service.create(requestContext, rawData);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ indexId: INDEX_ID, query: QUERY });
      const dbData = {
        rev: 0,
        createdBy: uid,
        updatedBy: uid,
        indexId: INDEX_ID,
        query: QUERY,
        result: RESULT,
      };
      expect(dbService.table.item).toHaveBeenCalledWith(dbData);
    });
  });

  describe('update', () => {
    it('should call DBService with correct input', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const rawData = {
        indexId: INDEX_ID,
        query: QUERY,
        result: RESULT,
      };

      // OPERATE
      await service.update(requestContext, rawData);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ indexId: INDEX_ID });
      expect(dbService.table.rev).toHaveBeenCalledWith(undefined);
      const dbData = {
        updatedBy: uid,
        indexId: INDEX_ID,
        query: QUERY,
        result: RESULT,
      };
      expect(dbService.table.item).toHaveBeenCalledWith(dbData);
    });

    it('should throw error when the cache does not exist', async () => {
      // BUILD
      const requestContext = { principalIdentifier: 'updatePrincipalIdentifier' };
      const rawData = { indexId: INDEX_ID, query: QUERY, result: RESULT };
      const error = { code: 'ConditionalCheckFailedException' };
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      // OPERATE and CHECK
      await expect(service.update(requestContext, rawData)).rejects.toThrow(
        `costApiCache with indexId "${INDEX_ID}" does not exist`,
      );
    });
  });
});
