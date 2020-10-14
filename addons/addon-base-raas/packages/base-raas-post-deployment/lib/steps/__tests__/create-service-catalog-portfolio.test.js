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

// TODO: Remove extra classes if found a better way
/* eslint-disable max-classes-per-file */
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

// Mocked dependencies
jest.mock('../../../../../../addon-base/packages/services/lib/aws/aws-service');
const AwsServiceMock = require('../../../../../../addon-base/packages/services/lib/aws/aws-service');

jest.mock('../../../../../../addon-base/packages/services/lib/db-service');
const DbServiceMock = require('../../../../../../addon-base/packages/services/lib/db-service');

jest.mock('../../../../../../addon-base-post-deployment/packages/base-post-deployment/lib/deployment-store-service');
const DeploymentStoreServiceMock = require('../../../../../../addon-base-post-deployment/packages/base-post-deployment/lib/deployment-store-service');

jest.mock(
  '../../../../../../addon-environment-sc-api/packages/environment-type-mgmt-services/lib/environment-type/env-type-candidate-service',
);
const EnvTypeCandidateServiceMock = require('../../../../../../addon-environment-sc-api/packages/environment-type-mgmt-services/lib/environment-type/env-type-candidate-service');
const CreateServiceCatalogPortfolio = require('../create-service-catalog-portfolio');

describe('CreateServiceCatalogPortfolio', () => {
  let service;
  let aws;
  let settings;
  let loggingService;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
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

  describe('Create/update portfolio', () => {
    it('should NOT fail', async () => {
      // BUILD
      // This will assign 'sample-user-namespace' to portfolioToCreate.DisplayName
      settings.get = jest.fn(() => 'sample-user-namespace');
      service.getS3Object = jest.fn();

      // OPERATE & CHECK
      // Happy-path: Make sure no exceptions are thrown
      await service.createPortfolio();
    });

    it('should NOT fail if a previously created one exists', async () => {
      // BUILD
      settings.getBoolean = jest.fn(() => true);
      settings.get = jest.fn(() => 'sample-user-namespace');
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

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      await service.createOrUpdatePortfolio();

      // CHECK
      expect(service.updateProducts).toHaveBeenCalled();
    });

    it('should NOT fail if a previously created one does not exist', async () => {
      // BUILD
      settings.getBoolean = jest.fn(() => true);
      // This will assign 'sample-user-namespace' to portfolioToCreate.DisplayName
      settings.get = jest.fn(() => 'sample-user-namespace');
      service.createPortfolio = jest.fn();
      service.findDeploymentItem = jest.fn(() => undefined);

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      await service.createOrUpdatePortfolio();

      // CHECK
      expect(service.createPortfolio).toHaveBeenCalled();
    });

    it('should NOT fail if a previous version was undefined', async () => {
      // BUILD
      const lastVersion = undefined;
      const expectedNextVersion = 'v2';

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      const nextVersion = await service.getNextArtifactVersion(lastVersion);

      // CHECK
      expect(nextVersion).toEqual(expectedNextVersion);
    });

    it('should NOT fail if a previous version had a different version format', async () => {
      // BUILD
      const lastVersion = 'ABC-XYZ';
      const expectedNextVersion = 'v2';

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      const nextVersion = await service.getNextArtifactVersion(lastVersion);

      // CHECK
      expect(nextVersion).toEqual(expectedNextVersion);
    });

    it('should give the next best version for format V2.0.0', async () => {
      // BUILD
      const lastVersion = 'V2.0.0';
      const expectedNextVersion = 'v3';

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      const nextVersion = await service.getNextArtifactVersion(lastVersion);

      // CHECK
      expect(nextVersion).toEqual(expectedNextVersion);
    });

    it('should give the next best version for format V50', async () => {
      // BUILD
      const lastVersion = 'V50';
      const expectedNextVersion = 'v51';

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      const nextVersion = await service.getNextArtifactVersion(lastVersion);

      // CHECK
      expect(nextVersion).toEqual(expectedNextVersion);
    });

    it('should carry on version updates with updated format', async () => {
      // BUILD
      const lastVersion = 'v10';
      const expectedNextVersion = 'v11';

      // OPERATE
      // Happy-path: Make sure no exceptions are thrown
      const nextVersion = await service.getNextArtifactVersion(lastVersion);

      // CHECK
      expect(nextVersion).toEqual(expectedNextVersion);
    });
  });
});
