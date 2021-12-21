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
const { sleep } = require('@aws-ee/base-services/lib/helpers/utils');

/**
 * Creates the default service catalog product.
 */
async function createDefaultServiceCatalogProduct(setup) {
  const s3 = await setup.aws.services.s3();
  const globalNamespace = setup.aws.settings.get('globalNamespace');
  const bucket = `${globalNamespace}-external-templates`;
  const templateId = 'default-integration-test-product';
  const template = `./support/service-catalog/${templateId}.yml`;
  const key = `${templateId}-${Date.now()}.yml`;
  const templateUrl = `https://${bucket}.s3.amazonaws.com/${key}`;

  await s3.uploadFile(bucket, key, template);

  const serviceCatalog = await setup.aws.services.serviceCatalog();
  const portfolioId = await getPortfolioId(setup);

  const productInfo = await serviceCatalog.createProduct(
    'Integration Test',
    'Product for Integration Test',
    templateUrl,
  );

  // Delay to prevent eventual consistency issues from affecting the next call.
  await sleep(1000);

  await serviceCatalog.associateProductWithPortfolio(productInfo.productId, portfolioId);

  const namespace = setup.aws.settings.get('namespace');
  const roleName = `${namespace}-LaunchConstraint`;

  // Delay to prevent eventual consistency issues from affecting the next call.
  await sleep(1000);

  const constraintId = await serviceCatalog.createConstraint(productInfo.productId, portfolioId, 'LAUNCH', roleName);

  const templateS3Path = `s3://${bucket}/${key}`;

  // Large delay needed to ensure the above service catalog changes are fully persisted.
  await sleep(30000);

  return { ...productInfo, portfolioId, constraintId, templateS3Path };
}

/**
 * Creates the default service catalog product.
 */
async function deleteDefaultServiceCatalogProduct(setup, productInfo) {
  const serviceCatalog = await setup.aws.services.serviceCatalog();

  await serviceCatalog.deleteConstraint(productInfo.constraintId);
  await serviceCatalog.disassociateProductFromPortfolio(productInfo.productId, productInfo.portfolioId);
  await serviceCatalog.deleteProduct(productInfo.productId);

  const s3 = await setup.aws.services.s3();

  await s3.deleteObject(productInfo.templateS3Path);
}

/**
 * Adds product information to a Workspace Type
 */
function addProductInfo(workspaceType, productInfo) {
  return {
    ...workspaceType,
    product: { productId: productInfo.productId },
    provisioningArtifact: { id: productInfo.provisioningArtifactId },
  };
}

async function getPortfolioId(setup) {
  const db = await setup.aws.services.dynamoDb();
  const deploymentItem = await db.tables.deploymentStore
    .getter()
    .key({ type: 'default-sc-portfolio', id: 'default-SC-portfolio-1' })
    .projection(['value'])
    .get();
  const deploymentValue = JSON.parse(deploymentItem.value);

  return deploymentValue.portfolioId;
}

module.exports = { createDefaultServiceCatalogProduct, deleteDefaultServiceCatalogProduct, addProductInfo };
