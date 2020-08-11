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
// const EnvTypeCandidateService = require('../../../../../addon-environment-sc-api/packages/environment-type-mgmt-services/lib/environment-type/env-type-candidate-service.js');
// const {
//   getServiceCatalogClient,
// } = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-service-catalog-helper');

// To add a new service catalog CfN template, perform the following steps:
// Add the file in addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/service-catalog
// Add the filename to this list in the variable below (productsToCreate)
const productsToCreate = ['ec2-linux-instance', 'sagemaker-notebook-instance', 'emr-cluster', 'ec2-windows-instance'];

const autoCreateVersion = 'V1.0';
const autoCreateDesc = 'Auto-created during post deployment';
const deploymentItemId = 'default-SC-portfolio-1';

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
    this.dependency(['aws', 'jsonSchemaValidationService', 'deploymentStoreService', 'envTypeCandidateService']);
  }

  async createOrUpdatePortfolio() {
    const createServiceCatalogPortfolio = this.settings.getBoolean(settingKeys.createServiceCatalogPortfolio);
    if (!createServiceCatalogPortfolio) {
      this.log.info('Service catalog portfolio creation is disabled. Skipping this post-deployment step...');
      return;
    }

    let existingPortfolio = '';
    let portfolioToUpdate = {
      portfolioId: '',
      products: [],
    };

    existingPortfolio = await this.findDeploymentItem({ id: deploymentItemId });
    if (!existingPortfolio) {
      // No portfolio was created yet. Creating...
      portfolioToUpdate = await this.createPortfolio(portfolioToUpdate);
    } else {
      const existingPortfolioValue = JSON.parse(existingPortfolio.value);
      portfolioToUpdate.portfolioId = existingPortfolioValue.portfolioId;
      // Portfolio alreday exists, need to check and update products as necessary
      portfolioToUpdate = await this.updateProducts(portfolioToUpdate);
    }

    // Either create/update, we'll be updating deploymentItem in DB
    await this.createDeploymentItem({ id: deploymentItemId, strValue: JSON.stringify(portfolioToUpdate) });
    this.log.info('Service catalog portfolio create/update completed.');
  }

  async createPortfolio(portfolioToUpdate) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });

    const displayName = this.settings.get(settingKeys.namespace);
    const portfolioToCreate = {
      DisplayName: displayName /* required */,
      ProviderName: '_system_' /* required */,
      Description: autoCreateDesc,
    };
    let deploymentItem;

    try {
      const serviceCatalogInfo = await servicecatalog.createPortfolio(portfolioToCreate).promise();
      const portfolioId = serviceCatalogInfo.PortfolioDetail.Id;
      portfolioToUpdate.portfolioId = portfolioId;

      await this._associatePortfolioWithRole(portfolioId);
      this.log.info(`Finished creating service catalog portfolio ${portfolioId}`);

      // Portfolio's ready, now let's add products
      deploymentItem = await this.createAllProducts(portfolioToUpdate);
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }
    return deploymentItem;
  }

  _getAllProductParams() {
    const productsList = [];

    _.map(productsToCreate, productToCreate => {
      const product = this._getProductParam(productToCreate);
      productsList.push(product);
    });

    return productsList;
  }

  _getProductParam(productToCreate) {
    const s3BucketName = this.settings.get(settingKeys.deploymentBucketName);
    const product = {
      Name: productToCreate,
      Description: autoCreateDesc,
      Owner: '_system_',
      ProductType: 'CLOUD_FORMATION_TEMPLATE',
      ProvisioningArtifactParameters: {
        DisableTemplateValidation: true, // Ensure provisioning these products in Galileo works
        Info: {
          LoadTemplateFromURL: `https://${s3BucketName}.s3.amazonaws.com/service-catalog-products/${productToCreate}.cfn.yml`,
        },
        Type: 'CLOUD_FORMATION_TEMPLATE',
        Name: autoCreateVersion, // Could be used as a version id in the future, for now, just a placeholder
      },
    };
    return product;
  }

  async createAllProducts(portfolioToUpdate) {
    const productsList = this._getAllProductParams();
    await Promise.all(
      _.map(productsList, async product => {
        try {
          const productData = await this.createProduct(product, portfolioToUpdate);
          portfolioToUpdate.products.push(productData);
        } catch (err) {
          this.log.info(`error ${err}`);
          // In case of any error let it bubble up
          throw err;
        }
      }),
    );

    return portfolioToUpdate;
  }

  async createProduct(product, portfolioToUpdate) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });

    let productInfo = await servicecatalog.createProduct(product).promise();
    this.log.info('Created a product');
    const productId = productInfo.ProductViewDetail.ProductViewSummary.ProductId;
    const provisioningArtifactId = productInfo.ProvisioningArtifactDetail.Id;
    const documentData = await this.getS3Object(product.Name);

    const associationParam = { PortfolioId: portfolioToUpdate.portfolioId, ProductId: productId };
    await servicecatalog.associateProductWithPortfolio(associationParam).promise();
    await this.createLaunchConstraint(portfolioToUpdate.portfolioId, productId);

    const retProd = {
      productId: productId,
      provisioiningArtifactId: provisioningArtifactId,
      data: '' /*await this.createHash(documentData)*/,
    };
    return retProd;
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
      const iamParams = { RoleName: envMgmtRoleName };
      const res = await iam.getRole(iamParams).promise();
      const roleArn = res.Role.Arn;
      params.PrincipalARN = roleArn;

      await servicecatalog.associatePrincipalWithPortfolio(params).promise();
      this.log.info(`Associated ${envMgmtRoleName} role to portfolio id ${portfolioId}`);
    } catch (err) {
      this.log.info(`error ${err}`);
      // In case of any error let it bubble up
      throw err;
    }
  }

  async updateProducts(portfolioToUpdate) {
    const envTypeCandidateService = await this.service('envTypeCandidateService');
    const envTypesAvailable = await envTypeCandidateService.list(getSystemRequestContext(), {
      filter: { status: '*' },
    });

    let envTypeProductNames = [];
    _.map(envTypesAvailable, obj => {
      envTypeProductNames.push(obj.product.name);
    });

    const updatePromises = _.map(productsToCreate, async productToCreate => {
      if (_.includes(envTypeProductNames, productToCreate)) {
        // Check if artifact we created exists.
        const deploymentItem = await this.findDeploymentItem({ id: deploymentItemId });
        const existingPortfolioValue = JSON.parse(deploymentItem.value);
        const deployedProducts = existingPortfolioValue.products || [];
        const productFound = deployedProducts.find(x => x.productId === productToCreate);
        if (!productFound) {
          // new product, create it
          const product = this._getProductParam(productToCreate);
          portfolioToUpdate = await this.createProduct(product, portfolioToUpdate);
        } else {
          // check if productFound.provisioiningArtifactId exists in envTypesAvailable's products
          //
          // If yes, compare hash - new artifact and update deploymentItem if different - else skip
          // const artifactData = await this.getS3Object(productToCreate).promise();    // Latest in S3
          // compute hash of above
          // // -- If some Lambda@Edge function version is configured on CloudFront then get CodeSha256 for that version
          // const existingSha256 = existingLambdaArn && (await this.getLambdaCodeSha256(existingLambdaArn));
          // // -- Get latest CodeSha256 value for the Lambda
          // const latestSha256 = await this.getLambdaCodeSha256(latestEdgeLambdaArn);
          // // -- If the CodeSha256 value for the latest Lambda@Edge matches the one that's configured on CloudFront, then
          // //    -- There is nothing to do. The latest Lambda is already configured on CloudFront. Just return.
          // if (existingSha256 === latestSha256) {
          //   this.log.info(
          //     `Skip updating cloudfront distribution "${cloudFrontId}"". The Lambda@Edge version "${latestEdgeLambdaArn}" is already configured and has latest code.`,
          //   );
          //   return;
          //
          // If artifact does not exist, user either deleted it or this is a different product - skip either way
        }
      } else {
        // product does not exist in envTypesAvailable
        const product = this._getProductParam(productToCreate);
        portfolioToUpdate = await this.createProduct(product);
      }
    });
    await Promise.all(updatePromises);

    return portfolioToUpdate;
  }

  async createProductArtifact(productId, productToCreate) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const s3BucketName = this.settings.get(settingKeys.deploymentBucketName);
    var params = {
      Parameters: {
        /* required */
        Info: {
          /* required */
          LoadTemplateFromURL: `https://${s3BucketName}.s3.amazonaws.com/service-catalog-products/${productToCreate}.cfn.yml`,
        },
        DisableTemplateValidation: true,
        Type: CLOUD_FORMATION_TEMPLATE,
      },
      ProductId: productId /* required */,
    };
    const data = await servicecatalog.createProvisioningArtifact(params).promise();
  }

  async createHash() {
    // TODO
    return 'TempHash';
  }

  async getS3Object(productName) {
    const aws = await this.service('aws');
    const s3Client = new aws.sdk.S3();
    const s3BucketName = this.settings.get(settingKeys.deploymentBucketName);
    const params = {
      Bucket: s3BucketName,
      Key: `service-catalog-products/${productName}.cfn.yml`,
    };
    const data = await s3Client.getObject(params).promise();
    return data.Body.toString('utf-8');
  }

  async createLaunchConstraint(portfolioId, productId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const launchConstraintRoleName = this.settings.get(settingKeys.launchConstraintRoleName);

    try {
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

  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.find({ type: 'post-deployment-step', id });
  }

  async createDeploymentItem({ id, strValue }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.createOrUpdate({ type: 'post-deployment-step', id: id, value: strValue });
  }

  async execute() {
    return this.createOrUpdatePortfolio();
  }
}

module.exports = CreateServiceCatalogPortfolio;
