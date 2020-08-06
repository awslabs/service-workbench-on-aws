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
  envMgmtRoleName: 'envMgmtRoleName',
  launchConstraintRoleName: 'launchConstraintRoleName',
};

class CreateServiceCatalogPortfolio extends Service {
  constructor() {
    super();
    this.dependency('aws');
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

    const displayName = this.settings.get(settingKeys.namespace);
    const portfolioToCreate = {
      DisplayName: `${displayName}` /* required */,
      ProviderName: '_system_' /* required */,
      Description: 'Created during Galileo post deployment',
    };

    // guard for checking portfolio exists (would skip new stuff)
    if (await this.duplicateExists(displayName)) {
      this.log.info(`Portfolio with name ${displayName} already exists. Skipping this step...`);
      return;
    }

    try {
      const serviceCatalogInfo = await servicecatalog.createPortfolio(portfolioToCreate).promise();
      const portfolioId = serviceCatalogInfo.PortfolioDetail.Id;
      await this.associatePortfolioWithRole(portfolioId);
      this.log.info(`Finished creating service catalog portfolio ${portfolioId}`);
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }
  }

  async duplicateExists(displayName) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });

    // guard for checking portfolio exists
    const params = { PageSize: 20 };
    let duplicateHit = false;
    do {
      const data = await servicecatalog.listPortfolios(params).promise();
      params.PageToken = data.NextPageToken;

      _.forEach(data.PortfolioDetails, item => {
        // eslint-disable-line no-loop-func
        if (item.DisplayName === displayName) {
          duplicateHit = true;
        }
      });
    } while (params.PageToken);

    return duplicateHit;
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
          Name: 'V1.0.0', // Could be used as a version id in the future, for now, just a placeholder
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

    _.map(productsToCreate, async product => {
      try {
        let productInfo = await servicecatalog.createProduct(product).promise();
        const productId = productInfo.ProductViewDetail.ProductViewSummary.ProductId;

        const associationParam = { PortfolioId: portfolioId, ProductId: productId };
        await servicecatalog.associateProductWithPortfolio(associationParam).promise();

        await this.createLaunchConstraint(portfolioId, productId);
      } catch (err) {
        this.log.info(`error ${err}`);
        // In case of any error let it bubble up
        throw err;
      }
    });
  }

  async associatePortfolioWithRole(portfolioId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const iam = new aws.sdk.IAM({ apiVersion: '2010-05-08' });
    const envMgmtRoleName = this.settings.get(settingKeys.envMgmtRoleName);

    const params = {
      PortfolioId: `${portfolioId}` /* required */,
      PrincipalARN: '' /* required */, // Roles generated now
      PrincipalType: 'IAM' /* required */,
    };

    try {
      const iamParams = { RoleName: `${envMgmtRoleName}` };
      const res = await iam.getRole(iamParams).promise();
      const roleArn = res.Role.Arn;
      params.PrincipalARN = `${roleArn}`;

      await servicecatalog.associatePrincipalWithPortfolio(params).promise();
      this.log.info(`Associated ${envMgmtRoleName} role to portfolio id ${portfolioId}`);
      await this.createProducts(portfolioId);
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }
  }

  async createLaunchConstraint(portfolioId, productId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const launchConstraintRoleName = this.settings.get(settingKeys.launchConstraintRoleName);

    try {
      // prepare createConstraint params
      const params = {
        Parameters: JSON.stringify({
          LocalRoleName: `${launchConstraintRoleName}`,
        }) /* required */,
        PortfolioId: `${portfolioId}` /* required */,
        ProductId: `${productId}` /* required */,
        Type: 'LAUNCH' /* required */,
        Description: `Launch as local role ${launchConstraintRoleName}`,
      };

      // create Launch Constraint for each product
      const response = await servicecatalog.createConstraint(params).promise();
      this.log.info(`Applied constraint role ${launchConstraintRoleName} to product id ${productId}`);
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }
  }

  async execute() {
    return this.createServiceCatalogPortfolio();
  }
}

module.exports = CreateServiceCatalogPortfolio;
