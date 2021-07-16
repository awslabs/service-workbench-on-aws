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

jest.mock('../compute-price-service.js');
const ComputePriceService = require('../compute-price-service.js');
const ComputePlatformService = require('../compute-platform-service');

describe('ComputePlatformService', () => {
  let service;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DBServiceMock());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('computePriceService', new ComputePriceService());
    container.register('computePlatformService', new ComputePlatformService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('computePlatformService');
  });

  describe('computePlatformService', () => {
    it('should list empty configurations', async () => {
      // BUILD
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };

      // OPERATE
      const result = await service.listConfigurations(requestContext, { platformId: '', includePrice: false });

      // CHECK
      expect(result).toEqual([]);
    });
  });
});
