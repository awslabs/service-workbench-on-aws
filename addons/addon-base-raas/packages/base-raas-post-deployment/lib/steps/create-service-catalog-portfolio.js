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

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  createServiceCatalogPortfolio: 'createServiceCatalogPortfolio',
  namespace: 'namespace',
  deploymentBucketName: 'deploymentBucketName',
};

class CreateServiceCatalogPortfolio extends Service {
  constructor() {
    super();
    this.dependency('aws');
    this.productIds = [];
  }

  /*
   * Pseudo Code:
   * -- Search for a portfolio with the default namespace; If found, skip
   * -- If portfolio not found, create portfolio and add products in it
   * -- Create role and assign to this portfolio
   */

  async createServiceCatalogPortfolio() {
    const createServiceCatalogPortfolio = this.settings.getBoolean(settingKeys.createServiceCatalogPortfolio);
    if (!createServiceCatalogPortfolio) {
      this.log.info('Service catalog portfolio creation is disabled. Skipping this step...');
      return;
    }

    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });

    // guard for checking portfolio exists (would skip new stuff)

    const namespace = this.settings.get(settingKeys.namespace);
    this.log.info(`Creating portfolio with name ${namespace}`);
    const portfolioToCreate = {
      DisplayName: `${namespace}` /* required */,
      ProviderName: '_system_' /* required */,
      Description: 'Created during Galileo post deployment',
    };

    try {
      const serviceCatalogInfo = await servicecatalog.createPortfolio(portfolioToCreate).promise();
      // .then(function(serviceCatalogInfo) {
      //   portfolioId = serviceCatalogInfo.PortfolioDetail.Id;
      // });
      const portfolioId = serviceCatalogInfo.PortfolioDetail.Id;
      await this.associatePortfolioWithRole(portfolioId);
      this.log.info(`Finished creating service catalog portfolio ${portfolioId}`);
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }
  }

  getProductsList() {
    const s3BucketName = this.settings.get(settingKeys.deploymentBucketName);
    const productsList = [];

    const productsToCreate = [
      'service-catalog-products/ec2-linux-instance.cfn.yml',
      'service-catalog-products/sagemaker-notebook-instance.cfn.yml',
      'service-catalog-products/emr-cluster.cfn.yml',
      'service-catalog-products/ec2-windows-instance.cfn.yml',
      // List your newly added service catalog CfN templates here, and add a case statement below
    ];

    _.map(productsToCreate, productToCreate => {
      let productName;

      switch (productToCreate) {
        case 'service-catalog-products/ec2-linux-instance.cfn.yml':
          productName = 'EC2-Linux';
          break;
        case 'service-catalog-products/sagemaker-notebook-instance.cfn.yml':
          productName = 'Sagemaker';
          break;
        case 'service-catalog-products/ec2-windows-instance.cfn.yml':
          productName = 'EC2-Windows';
          break;
        case 'service-catalog-products/emr-cluster.cfn.yml':
          productName = 'EMR';
          break;
        default:
          break;
      }

      const product = {
        Name: productName,
        Owner: '_system_',
        ProductType: 'CLOUD_FORMATION_TEMPLATE',
        ProvisioningArtifactParameters: {
          DisableTemplateValidation: true, // Ensure provisioning these products in Galileo works
          Info: {
            LoadTemplateFromURL: `https://${s3BucketName}.s3.amazonaws.com/${productToCreate}`,
          },
          Type: 'CLOUD_FORMATION_TEMPLATE',
          Name: 'Artifact', // Could be used as a version id in the future, for now, just a placeholder
        },
      };

      productsList.push(product);
    });

    return productsList;
  }

  async createProducts(portfolioId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const productsToCreate = this.getProductsList();

    this.log.info(`Creating products for portfolio id ${portfolioId}`);
    let productIds = [];

    const creationPromises = _.map(productsToCreate, async product => {
      try {
        // Add guard - don't recreate

        let productInfo = await servicecatalog.createProduct(product).promise();
        const productId = productInfo.ProductViewDetail.ProductViewSummary.ProductId;

        const associationParam = { PortfolioId: portfolioId, ProductId: productId };
        await servicecatalog.associateProductWithPortfolio(associationParam).promise();

        this.log.info(`Product ${productId} created and associated with ${portfolioId}`);
        productIds.push(productId);
      } catch (err) {
        this.log.info(`error ${err}`);
        // In case of any error let it bubble up
        throw err;
      }
    });
    await Promise.all(creationPromises);

    await this.createConstraintForPortfolio(portfolioId, productIds);

    this.log.info('Finished creating products');
  }

  async associatePortfolioWithRole(portfolioId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const iam = new aws.sdk.IAM({ apiVersion: '2010-05-08' });

    const namespace = this.settings.get(settingKeys.namespace);
    const params = {
      PortfolioId: `${portfolioId}` /* required */,
      PrincipalARN: '' /* required */, // Roles generated now
      PrincipalType: 'IAM' /* required */,
    };

    let roleArn;

    try {
      const iamParams = { RoleName: `${namespace}-EnvMgmt` };
      await iam
        .getRole(iamParams)
        .promise()
        .then(function(res) {
          roleArn = res.Role.Arn;
          params.PrincipalARN = `${roleArn}`;
        });

      await servicecatalog
        .associatePrincipalWithPortfolio(params)
        .promise()
        .then();
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }

    await this.createProducts(portfolioId);

    this.log.info(`Associated EnvMgmtRole to portfolio id ${portfolioId}`);
  }

  async createConstraintForPortfolio(portfolioId, productIds) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const namespace = this.settings.get(settingKeys.namespace);

    // create roles

    // prepare createConstraint params
    const params = {
      Parameters: `{"LocalRoleName": "raas-sc-"` /* required */, //Need to create roles first
      PortfolioId: `${portfolioId}` /* required */,
      ProductId: 'STRING_VALUE' /* required */,
      Type: 'LAUNCH' /* required */,
    };

    // create Launch Constraints
  }

  async execute() {
    return this.createServiceCatalogPortfolio();
  }
}

module.exports = CreateServiceCatalogPortfolio;
