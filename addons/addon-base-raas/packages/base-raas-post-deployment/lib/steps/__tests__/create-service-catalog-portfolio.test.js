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

// Mocked dependencies
jest.mock('../../../../../../addon-base/packages/services/lib/aws/aws-service');
const AwsServiceMock = require('../../../../../../addon-base/packages/services/lib/aws/aws-service');

const CreateServiceCatalogPortfolio = require('../create-service-catalog-portfolio');

describe('CreateServiceCatalogPortfolio', () => {
  const createServiceCatalogPortfolioStep = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('createServiceCatalogPortfolio', new CreateServiceCatalogPortfolio());
    container.register('aws', new AwsServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    createPortfolio = await container.find('createServiceCatalogPortfolio');
  });

  describe('createServiceCatalogPortfolio', () => {
    it('should pass', async () => {
      const params = { displayName: 'test' };
      createPortfolio.createServiceCatalogPortfolio = jest.fn(() => true);
      createPortfolio._duplicateExists = jest.fn(params => false);

      await createPortfolio.createServiceCatalogPortfolio();
      //   expect.hasAssertions();
      expect(createPortfolio._duplicateExists).toHaveBeenCalledWith({ displayName: 'test' });
    });
  });
});
