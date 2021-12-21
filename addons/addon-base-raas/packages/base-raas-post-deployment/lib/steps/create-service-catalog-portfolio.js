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
const { createHash } = require('@aws-ee/base-services/lib/helpers/utils');
const Service = require('@aws-ee/base-services-container/lib/service');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

// To add a new service catalog CfN template,
// Add the file in addons/addon-base-raas/packages/base-raas-cfn-templates/src/templates/service-catalog
// Note: 1. The *Product Name* that will be used to create/update/record for this auto-create process will be the displayName value.
//          If displayName is not provided, then the filename will be used instead
//       2. Please make sure there isn't a product with the same *Product Name* already in SC,
//          else it will get skipped during creation
const productsToCreate = [
  // ADD YOUR NEW CFN FILE DETAILS HERE
  // {
  //   displayName: 'Custom Product Name',  // Please make sure the display name is unique in this list
  //   filename: 'your-cfn-instance-template', // This is the name of your file you've added in the step above
  //   description: `This product lets us provision the following:
  //   * Product Feature 1`,
  //   * Product Feature 2`,
  // },
  // DO NOT DELETE ANY ITEMS IN THIS LIST (else, you'll lose auto-create/update functionality for them)
  {
    filename: 'ec2-linux-instance',
    displayName: 'EC2 Linux',
    description: `* An EC2 Linux instance with SSH access \n* Secure compute in the cloud`,
  },
  {
    filename: 'sagemaker-notebook-instance',
    displayName: 'SageMaker Notebook',
    description: `An Amazon SageMaker Jupyter Notebook that comes with: \n* TensorFlow \n* Apache MXNet \n* Scikit-learn
  `,
  },
  {
    filename: 'emr-cluster',
    displayName: 'EMR',
    description: `An Amazon EMR research workspace that comes with: \n* Hail 0.2 \n* Jupyter Lab \n* Spark 2.4.4 \n* Hadoop 2.8.5
`,
  },
  {
    filename: 'ec2-windows-instance',
    displayName: 'EC2 Windows',
    description: `* An EC2 Windows instance with RDP access \n* Secure compute in the cloud`,
  },
];

const autoCreateVersion = 'v1';
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
    this.dependency(['aws', 'deploymentStoreService', 'envTypeCandidateService']);
  }

  async createOrUpdatePortfolio() {
    const createServiceCatalogPortfolio = this.settings.getBoolean(settingKeys.createServiceCatalogPortfolio);
    if (!createServiceCatalogPortfolio) {
      this.log.info('Service catalog portfolio creation is disabled. Skipping this post-deployment step...');
      return;
    }

    let portfolioToUpdate;
    const existingDeploymentItem = await this.findDeploymentItem({ id: deploymentItemId });
    if (!existingDeploymentItem) {
      // No portfolio was created yet. Creating...
      portfolioToUpdate = await this.createPortfolio();
    } else {
      const deploymentItemValue = JSON.parse(existingDeploymentItem.value);
      // Portfolio alreday exists, need to check and update products as necessary
      portfolioToUpdate = await this.updateProducts(deploymentItemValue.portfolioId);
    }

    // Either create/update, we'll be updating deploymentItem in DB
    await this.createDeploymentItem({ id: deploymentItemId, strValue: JSON.stringify(portfolioToUpdate) });
    this.log.info('Service catalog portfolio create/update completed.');
  }

  async createPortfolio() {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const displayName = this.settings.get(settingKeys.namespace);
    const portfolioToCreate = {
      DisplayName: displayName /* required */,
      ProviderName: '_system_' /* required */,
      Description: autoCreateDesc,
    };
    const portfolioToUpdate = {
      portfolioId: '',
      products: [],
    };

    try {
      const serviceCatalogInfo = await servicecatalog.createPortfolio(portfolioToCreate).promise();
      const portfolioId = serviceCatalogInfo.PortfolioDetail.Id;
      portfolioToUpdate.portfolioId = portfolioId;

      await this._associatePortfolioWithRole(portfolioId);
      this.log.info(`Finished creating service catalog portfolio ${portfolioId}`);

      // Portfolio's ready, now let's add products
      portfolioToUpdate.products = await this.createAllProducts();
      await Promise.all(
        _.map(portfolioToUpdate.products, async product => {
          await this.associatePortfolio(product.productId, portfolioId);
        }),
      );
      await Promise.all(
        _.map(portfolioToUpdate.products, async product => {
          await this.createLaunchConstraint(portfolioId, product.productId);
        }),
      );
    } catch (err) {
      this.log.error(err);
      // In case of any error let it bubble up
      throw err;
    }
    return portfolioToUpdate;
  }

  async createAllProducts() {
    const productsList = this._getAllProductParams();
    const productDataList = [];
    await Promise.all(
      _.map(productsList, async product => {
        const productData = await this.createProduct(product);
        productDataList.push(productData);
      }),
    );

    return productDataList;
  }

  async associatePortfolio(productId, portfolioId) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });

    const associationParam = { PortfolioId: portfolioId, ProductId: productId };
    const portfolioAssociation = await servicecatalog.associateProductWithPortfolio(associationParam).promise();
    return portfolioAssociation;
  }

  async createProduct(product) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });

    const productInfo = await servicecatalog.createProduct(product).promise();
    const productId = productInfo.ProductViewDetail.ProductViewSummary.ProductId;
    const provisioningArtifactId = productInfo.ProvisioningArtifactDetail.Id;

    // The name of the product we search for in S3 needs to be the filename
    // Since the users can chose to have a custom product display name, we search for its filename as follows
    let prodFileName = productsToCreate.find(p => p.displayName === product.Name).filename;
    if (!prodFileName) {
      // Maybe the user didn't add a custom display name for their product
      // In that case, match the name by filename
      prodFileName = productsToCreate.find(p => p.filename === product.Name).filename;
    }
    const productArtifactCfn = await this.getS3Object(prodFileName);

    const retProd = {
      productName: product.Name,
      productId,
      provisioningArtifactId,
      data: createHash(productArtifactCfn),
    };
    return retProd;
  }

  async updateProducts(existingPortfolioId) {
    const envTypeCandidateService = await this.service('envTypeCandidateService');
    const envTypesAvailable = await envTypeCandidateService.list(getSystemRequestContext(), {
      filter: { status: ['*'] },
    });

    const portfolioToUpdate = {
      portfolioId: existingPortfolioId,
      products: [],
    };

    const scAvailableProducts = _.map(envTypesAvailable, obj => ({
      productName: obj.product.name,
      provisioningArtifactId: obj.provisioningArtifact.id,
      provisioningArtifactName: obj.provisioningArtifact.name,
    }));
    const scAvailableProductNames = _.map(scAvailableProducts, p => p.productName);

    const updatePromises = _.map(productsToCreate, async productToCreate => {
      // If the user forgot to add displayName, we'll use filename instead to search
      const productName = productToCreate.displayName || productToCreate.filename;
      if (_.includes(scAvailableProductNames, productName)) {
        // Check if artifact we created exists and is latest.
        const deploymentItem = await this.findDeploymentItem({ id: deploymentItemId });
        const existingPortfolioValue = JSON.parse(deploymentItem.value);
        const deployedProducts = existingPortfolioValue.products || [];
        const productFound = deployedProducts.find(p => p.productName === productName);
        if (productFound) {
          // Find DB productFound.provisioningArtifactId in envTypesAvailable products
          const ScProduct = scAvailableProducts.find(s => s.productName === productName);
          if (productFound.provisioningArtifactId === ScProduct.provisioningArtifactId) {
            // If found, compare hash - upload new artifact if different - else skip
            const cfnTemplateBody = await this.getS3Object(productToCreate.filename); // Latest in S3
            const s3DataHash = createHash(cfnTemplateBody);
            const currentScObjectHash = productFound.data;
            const productDetails = {
              productName: productFound.productName,
              productId: productFound.productId,
              provisioningArtifactId: productFound.provisioningArtifactId,
              data: s3DataHash,
            };
            if (s3DataHash !== currentScObjectHash) {
              this.log.info(
                `A previously used CfN file was updated with new CfN product template data for ${productName}`,
              );
              // Get all provisioning artifacts for this product
              const latestVersionInSC = ScProduct.provisioningArtifactName;
              const newProvisioningId = await this.createProductArtifact(
                productFound.productId,
                productToCreate.filename,
                latestVersionInSC,
              );

              productDetails.provisioningArtifactId = newProvisioningId;
            }
            // Record in DB the latest (or unchanged) product details
            portfolioToUpdate.products.push(productDetails);
          } else {
            this.log.info(
              'Provisioning artifact ids do NOT match, a newer product version must have been uploaded by the user manually. This means the product is now being actively managed by the user',
            );
          }
        } else {
          this.log.info(
            `Product ${productName} was not found in the DB. A newer version for this product must have been be uploaded in SC manually`,
          );
        }
      } else {
        // Product does not exist in envTypesAvailable. Creating...
        const product = this._getProductParam(productToCreate);
        const productData = await this.createProduct(product);
        // Since this is a new product, we need to also associate the necessary roles and access while we're here
        const tempProductList = [productData];
        await Promise.all(
          _.map(tempProductList, async currentProduct => {
            await this.associatePortfolio(currentProduct.productId, portfolioToUpdate.portfolioId);
          }),
        );
        await Promise.all(
          _.map(tempProductList, async currentProduct => {
            await this.createLaunchConstraint(portfolioToUpdate.portfolioId, currentProduct.productId);
          }),
        );
        portfolioToUpdate.products.push(productData);
      }
    });
    await Promise.all(updatePromises);

    return portfolioToUpdate;
  }

  async createProductArtifact(productId, productFileName, latestVersionInSC) {
    const aws = await this.service('aws');
    const servicecatalog = new aws.sdk.ServiceCatalog({ apiVersion: '2015-12-10' });
    const s3BucketName = this.settings.get(settingKeys.deploymentBucketName);
    const productToCreate = productsToCreate.find(p => p.filename === productFileName);
    const nextProvArtifact = await this.getNextArtifactVersion(latestVersionInSC);
    const params = {
      Parameters: {
        Info: {
          LoadTemplateFromURL: `https://${s3BucketName}.s3.amazonaws.com/service-catalog-products/${productFileName}.cfn.yml`,
        },
        DisableTemplateValidation: true,
        Type: 'CLOUD_FORMATION_TEMPLATE',
        Description: productToCreate.description || autoCreateDesc,
        Name: nextProvArtifact,
      },
      ProductId: productId,
    };
    const data = await servicecatalog.createProvisioningArtifact(params).promise();
    return data.ProvisioningArtifactDetail.Id;
  }

  // For product artifacts in Service Catalog, versions and names are the same thing
  // If no previous version found, assign 'v2' (this will help in next update cycle)
  // This supports matching previous version format ("V1.0.0") but for simplification
  // the upcoming product artifact versions will have the format "v2"
  async getNextArtifactVersion(latestVersionInSC) {
    let returnVal = 'v2';
    // Only finds version strings that match patterns:
    // "V<n>", "V<n>.0", "V<n>.0.0", "v<n>", "v<n>.0", "v<n>.0.0"
    const pattern = /^(?:v|V)(\d+)?(?:\.\d+)?(?:\.(?:\d+))?$/;
    if (latestVersionInSC) {
      const parsedOutput = latestVersionInSC.match(pattern);
      if (parsedOutput && parsedOutput.length > 0) {
        returnVal = `v${parseInt(parsedOutput[1], 10) + 1}`;
      }
    }
    return returnVal;
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
          LocalRoleName: launchConstraintRoleName,
        }) /* required */,
        PortfolioId: portfolioId /* required */,
        ProductId: productId /* required */,
        Type: 'LAUNCH' /* required */,
        Description: `Launch as local role ${launchConstraintRoleName}`,
      };

      // create Launch Constraint for each product
      const launchConstraintAssoc = await servicecatalog.createConstraint(params).promise();
      this.log.info(`Applied constraint role ${launchConstraintRoleName} to product id ${productId}`);
      return launchConstraintAssoc;
    } catch (err) {
      this.log.error(err);
      // In case of any error let it bubble up
      throw err;
    }
  }

  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    let record = await deploymentStore.find({ type: 'default-sc-portfolio', id });
    if (!record) {
      // The old code had type = 'post-deployment-step', due to this the DB may have record with old type value
      record = await deploymentStore.find({ type: 'post-deployment-step', id });
    }
    return record;
  }

  async createDeploymentItem({ id, strValue }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    // The old code had type = 'post-deployment-step', due to this the DB may have record with old type value
    const recordWithOldType = await deploymentStore.find({ type: 'post-deployment-step', id });
    // Continue to use type = 'post-deployment-step' if db already has a record with that type
    const recordType = recordWithOldType ? 'post-deployment-step' : 'default-sc-portfolio';
    return deploymentStore.createOrUpdate({ type: recordType, id, value: strValue });
  }

  async execute() {
    return this.createOrUpdatePortfolio();
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
      this.log.error(err);
      // In case of any error let it bubble up
      throw err;
    }
  }

  _getAllProductParams() {
    return _.map(productsToCreate, productToCreate => this._getProductParam(productToCreate));
  }

  _getProductParam(productToCreate) {
    const s3BucketName = this.settings.get(settingKeys.deploymentBucketName);
    const product = {
      Name: productToCreate.displayName || productToCreate.filename, // If user chose not to provide custom display name
      Description: autoCreateDesc,
      Owner: '_system_',
      ProductType: 'CLOUD_FORMATION_TEMPLATE',
      ProvisioningArtifactParameters: {
        DisableTemplateValidation: true,
        Info: {
          LoadTemplateFromURL: `https://${s3BucketName}.s3.amazonaws.com/service-catalog-products/${productToCreate.filename}.cfn.yml`,
        },
        Type: 'CLOUD_FORMATION_TEMPLATE',
        Name: autoCreateVersion, // Could be used as a version id in the future, for now, just a placeholder
        Description: productToCreate.description || autoCreateDesc, // If user chose not to provide custom description
      },
    };
    return product;
  }
}

module.exports = CreateServiceCatalogPortfolio;
