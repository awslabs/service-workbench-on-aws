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
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');

// mocked dependencies
jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('../env-type-service');
const EnvTypeServiceMock = require('../env-type-service');

jest.mock('../../../../../../addon-base-post-deployment/packages/base-post-deployment/lib/deployment-store-service.js');
const DeploymentStoreServiceMock = require('../../../../../../addon-base-post-deployment/packages/base-post-deployment/lib/deployment-store-service.js');

const EnvTypeCandidateService = require('../env-type-candidate-service');

describe('EnvTypeCandidateService', () => {
  let service = null;
  let deploymentStoreService = null;
  beforeEach(async () => {
    // initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('aws', new AwsMock());
    container.register('envTypeService', new EnvTypeServiceMock());
    container.register('envTypeCandidateService', new EnvTypeCandidateService());
    container.register('deploymentStoreService', new DeploymentStoreServiceMock());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('envTypeCandidateService');
    deploymentStoreService = await container.find('deploymentStoreService');

    // skip authorization
    service.assertAuthorized = jest.fn();
    service.isAuthorized = jest.fn(() => {
      return true;
    });
  });
  describe('getPortfolioId', () => {
    it('return portfolio id on success', async () => {
      const record = {
        value: '{"portfolioId":"test-port-id"}',
      };
      deploymentStoreService.find = jest.fn(() => {
        return record;
      });
      const response = await service.getPortfolioId();
      expect(response).toEqual('test-port-id');
    });

    it('return empty string when record not found', async () => {
      const record = {
        value: '',
      };
      deploymentStoreService.find = jest.fn(() => {
        return record;
      });
      const response = await service.getPortfolioId();
      expect(response).toEqual('');
    });
  });
});
