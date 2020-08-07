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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');
const EnvTypeCandidateService = require('../../../../../addon-environment-sc-api/packages/environment-type-mgmt-services/lib/environment-type/env-type-candidate-service.js');
// const {
//   getServiceCatalogClient,
// } = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-service-catalog-helper');

// To add a new service catalog CfN template, perform the following steps:
// Add the file in addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/service-catalog
// Add the filename to this list in the variable below (productsToCreate)
// Add a case statement in _getProductsList()
const productsToCreate = [
  'ec2-linux-instance.cfn.yml',
  'sagemaker-notebook-instance.cfn.yml',
  'emr-cluster.cfn.yml',
  'ec2-windows-instance.cfn.yml',
];

const autoCreateVersion = 'V1.0';
const autoCreateDesc = 'Auto-created during post deployment';

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
    this.dependency(['aws', 'jsonSchemaValidationService', 'deploymentStoreService']);
  }

  /*
   * Create a ServiceCatalogPortfolio if not found, create an IAM role and assign it to this portfolio
   */
  async createServiceCatalogPortfolio() {
    const createServiceCatalogPortfolio = this.settings.getBoolean(settingKeys.createServiceCatalogPortfolio);
    if (!createServiceCatalogPortfolio) {
      this.log.info('Service catalog portfolio creation is disabled. Skipping this post-deployment step...');
      return;
    }

    // Before we do anything, let's check if the products we're about to add are added already
    // If yes, skip portfolio creation entirely
    // if (await this._duplicateExists()) {
    //   this.log.info(`All products we were about to add already exist. Skipping this post-deployment step...`);
    //   return;
    // }

    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });

    const displayName = this.settings.get(settingKeys.namespace);
    const portfolioToCreate = {
      DisplayName: displayName /* required */,
      ProviderName: '_system_' /* required */,
      Description: autoCreateDesc,
    };

    try {
      const serviceCatalogInfo = await servicecatalog.createPortfolio(portfolioToCreate).promise();
      const portfolioId = serviceCatalogInfo.PortfolioDetail.Id;
      await this._associatePortfolioWithRole(portfolioId);
      this.log.info(`Finished creating service catalog portfolio ${portfolioId}`);

      // Portfolio's ready, now let's add products
      await this.createProducts(portfolioId);
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }
  }

  async _duplicateExists() {
    const envTypesAvailable = EnvTypeCandidateService.list(getSystemRequestContext(), { filter: { status: '*' } });
    let duplicateProducts = [];

    _.map(envTypesAvailable, envTypeAvilable => {
      _.map(productsToCreate, productToCreate => {
        if (_.includes(productType, envTypeAvailable)) {
        }
      });
    });
  }

  _getProductsList() {
    const s3BucketName = this.settings.get(settingKeys.deploymentBucketName);
    const productsList = [];

    _.map(productsToCreate, productToCreate => {
      let productName;

      switch (productToCreate) {
        case 'ec2-linux-instance.cfn.yml':
          productName = 'EC2-Linux';
          break;
        case 'sagemaker-notebook-instance.cfn.yml':
          productName = 'Sagemaker';
          break;
        case 'ec2-windows-instance.cfn.yml':
          productName = 'EC2-Windows';
          break;
        case 'emr-cluster.cfn.yml':
          productName = 'EMR';
          break;
        default:
          break;
      }

      const product = {
        Name: productName,
        Description: autoCreateDesc,
        Owner: '_system_',
        ProductType: 'CLOUD_FORMATION_TEMPLATE',
        ProvisioningArtifactParameters: {
          DisableTemplateValidation: true, // Ensure provisioning these products in Galileo works
          Info: {
            LoadTemplateFromURL: `https://${s3BucketName}.s3.amazonaws.com/service-catalog-products/${productToCreate}`,
          },
          Type: 'CLOUD_FORMATION_TEMPLATE',
          Name: autoCreateVersion, // Could be used as a version id in the future, for now, just a placeholder
        },
      };

      productsList.push(product);
    });

    return productsList;
  }

  async createProducts(portfolioId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const productsToCreate = this._getProductsList();

    const creationPromises = _.map(productsToCreate, async product => {
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
    Promise.all(creationPromises);
  }

  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.find({ type: 'step-template', id });
  }

  async createDeploymentItem({ encodedId, yamlStr }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.createOrUpdate({ type: 'step-template', id: encodedId, value: yamlStr });
  }

  async _associatePortfolioWithRole(portfolioId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const iam = new aws.sdk.IAM({ apiVersion: '2010-05-08' });
    const envMgmtRoleName = this.settings.get(settingKeys.envMgmtRoleName);

    const params = {
      PortfolioId: portfolioId /* required */,
      PrincipalARN: '' /* required */,
      PrincipalType: 'IAM' /* required */,
    };

    try {
      const iamParams = { RoleName: `${envMgmtRoleName}` };
      const res = await iam.getRole(iamParams).promise();
      const roleArn = res.Role.Arn;
      params.PrincipalARN = `${roleArn}`;

      await servicecatalog.associatePrincipalWithPortfolio(params).promise();
      this.log.info(`Associated ${envMgmtRoleName} role to portfolio id ${portfolioId}`);
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
        PortfolioId: portfolioId /* required */,
        ProductId: productId /* required */,
        Type: 'LAUNCH' /* required */,
        Description: `Launch as local role ${launchConstraintRoleName}`,
      };

      // create Launch Constraint for each product
      await servicecatalog.createConstraint(params).promise();
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
