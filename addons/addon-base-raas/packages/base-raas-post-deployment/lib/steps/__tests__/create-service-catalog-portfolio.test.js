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
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

// Mocked dependencies
jest.mock('../../../../../../addon-base/packages/services/lib/aws/aws-service');
const AwsServiceMock = require('../../../../../../addon-base/packages/services/lib/aws/aws-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('../../../../../../addon-base/packages/services/lib/db-service');
const DbServiceMock = require('../../../../../../addon-base/packages/services/lib/db-service');
jest.mock('../../../../../../addon-base-post-deployment/packages/base-post-deployment/lib/deployment-store-service');
const DeploymentStoreServiceMock = require('../../../../../../addon-base-post-deployment/packages/base-post-deployment/lib/deployment-store-service');
jest.mock(
  '../../../../../../addon-environment-sc-api/packages/environment-type-mgmt-services/lib/environment-type/env-type-candidate-service',
);
const EnvTypeCandidateServiceMock = require('../../../../../../addon-environment-sc-api/packages/environment-type-mgmt-services/lib/environment-type/env-type-candidate-service');
const CreateServiceCatalogPortfolio = require('../create-service-catalog-portfolio');
const JsonSchemaValidationService = require('../../../../../../addon-base/packages/services/lib/json-schema-validation-service');

describe('CreateServiceCatalogPortfolio', () => {
  let service;
  let aws;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('log', new Logger());
    container.register('deploymentStoreService', new DeploymentStoreServiceMock());
    container.register('envTypeCandidateService', new EnvTypeCandidateServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('scPortfolioService', new CreateServiceCatalogPortfolio());

    await container.initServices();
    aws = await container.find('aws');
    class MockSC {
      constructor() {
        this.createPortfolio = jest.fn(() => ({
          promise: () =>
            Promise.resolve({
              PortfolioDetail: { Id: 'samplePortfolioId' },
            }),
        }));
        this.createProduct = jest.fn(() => ({
          promise: () =>
            Promise.resolve({
              ProductViewDetail: { ProductViewSummary: { ProductId: 'testProductId' } },
              ProvisioningArtifactDetail: { Id: 'sampleArtifactId' },
            }),
        }));
        this.createProvisioningArtifact = jest.fn(() => ({
          promise: () =>
            Promise.resolve({
              ProvisioningArtifactDetail: { Id: 'sampleArtifactId' },
            }),
        }));
        this.associatePrincipalWithPortfolio = jest.fn(() => ({ promise: () => Promise.resolve() }));
        this.associateProductWithPortfolio = jest.fn(() => ({ promise: () => Promise.resolve() }));
        this.createConstraint = jest.fn(() => ({ promise: () => Promise.resolve() }));
      }
    }
    class MockIAM {
      constructor() {
        this.getRole = jest.fn(() => ({
          promise: () => Promise.resolve({ Role: { Arn: 'sampleRoleArn' } }),
        }));
      }
    }
    class MockS3 {
      constructor() {
        this.getObject = jest.fn(() => ({
          promise: () => Promise.resolve({ Body: 'sampleCfnTemplateData' }),
        }));
      }
    }

    aws.sdk = {
      ServiceCatalog: MockSC,
      IAM: MockIAM,
      S3: MockS3,
    };
    envTypeCandidateService = await container.find('envTypeCandidateService');
    settings = await container.find('settings');
    loggingService = await container.find('log');
    loggingService.log = jest.fn(msg => {
      console.log(msg);
    });
    // suppress expected messages
    jest.spyOn(console, 'info').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('scPortfolioService');
  });

  describe('Create portfolio', () => {
    it('should fail since DisplayName is empty', async () => {
      // BUILD
      // This will assign empty string to portfolioToCreate.DisplayName
      settings.get = jest.fn(x => '');
      try {
        // OPERATE
        await service.createPortfolio();
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'minLength',
          dataPath: '.DisplayName',
          message: 'should NOT be shorter than 1 characters',
        });
      }
    });

    it('should NOT fail since portfolioToCreate schema is valid', async () => {
      // BUILD
      // This will assign 'sample-user-namespace' to portfolioToCreate.DisplayName
      settings.get = jest.fn(x => 'sample-user-namespace');
      service.getS3Object = jest.fn();

      // OPERATE & CHECK
      // Happy-path: Make sure no exceptions are thrown
      await service.createPortfolio();
    });

    it('should NOT fail if a previously created one exists', async () => {
      // BUILD
      settings.getBoolean = jest.fn(x => true);
      settings.get = jest.fn(x => 'sample-user-namespace');
      service.updateProducts = jest.fn();
      service.findDeploymentItem = jest.fn(() => ({
        value: {
          portfolioId: 'sample-portfolio',
          products: [
            {
              productName: 'testProductName',
              productId: 'testProductId',
              provisioningArtifactId: 'testProvisioningArtifactId',
              data: '1234',
            },
          ],
        },
      }));
      JSON.parse = jest.fn(() => service.findDeploymentItem);

      // OPERATE & CHECK
      // Happy-path: Make sure no exceptions are thrown
      await service.createOrUpdatePortfolio();
    });

    it('should NOT fail if a previously created one does not exist', async () => {
      // BUILD
      settings.getBoolean = jest.fn(x => true);
      // This will assign 'sample-user-namespace' to portfolioToCreate.DisplayName
      settings.get = jest.fn(x => 'sample-user-namespace');
      service.createPortfolio = jest.fn();
      service.findDeploymentItem = jest.fn(() => undefined);

      // OPERATE & CHECK
      // Happy-path: Make sure no exceptions are thrown
      await service.createOrUpdatePortfolio();
    });
  });

  describe('Create product', () => {
    it('should fail since required param Name is missing', async () => {
      // BUILD
      const product = {
        Description: 'Auto-Create Desc',
        Owner: '_system_',
        ProductType: 'CLOUD_FORMATION_TEMPLATE',
        ProvisioningArtifactParameters: {
          SampleParam: 'SampleValue',
        },
      };

      try {
        // OPERATE
        await service.createProduct(product);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'required',
          params: { missingProperty: 'Name' },
          message: "should have required property 'Name'",
        });
      }
    });

    it('should fail since param ProductType has invalid value', async () => {
      // BUILD
      const product = {
        Name: 'Auto-Create-Prod',
        Description: 'Auto-Create Desc',
        Owner: '_system_',
        ProductType: 'INVALID_TYPE',
        ProvisioningArtifactParameters: {
          SampleParam: 'SampleValue',
        },
      };

      try {
        // OPERATE
        await service.createProduct(product);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'enum',
          dataPath: '.ProductType',
          params: { allowedValues: ['CLOUD_FORMATION_TEMPLATE', 'MARKETPLACE'] },
          message: 'should be equal to one of the allowed values',
        });
      }
    });

    it('should NOT fail since product object is valid', async () => {
      // BUILD
      const product = {
        Name: 'Auto-Create-Prod',
        Description: 'Auto-Create Desc',
        Owner: '_system_',
        ProductType: 'CLOUD_FORMATION_TEMPLATE',
        ProvisioningArtifactParameters: {
          SampleParam: 'SampleValue',
        },
      };

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      await service.createProduct(product);
    });
  });

  describe('Create provisioning artifact', () => {
    it('should fail since required param productId is missing', async () => {
      // BUILD
      const productId = undefined;
      const productToCreate = 'SampleProd';
      try {
        // OPERATE
        await service.createProductArtifact(productId, productToCreate);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.payload).toBeDefined();
        const error = err.payload.validationErrors[0];
        expect(error).toMatchObject({
          keyword: 'required',
          params: { missingProperty: 'ProductId' },
          message: "should have required property 'ProductId'",
        });
      }
    });

    it('should NOT fail since product params are valid', async () => {
      // BUILD
      const productId = 'SampleProductId';
      const productToCreate = 'SampleProd';

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      await service.createProductArtifact(productId, productToCreate);
    });
  });
});
