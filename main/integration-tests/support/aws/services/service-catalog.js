/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
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

class ServiceCatalog {
  constructor({ aws, sdk }) {
    this.aws = aws;
    this.sdk = sdk;
  }

  async getProductName(productId) {
    const response = await this.sdk.describeProduct({ Id: productId }).promise();

    return response.ProductViewSummary.Name;
  }

  async createProduct(productName, description, templateUrl) {
    const response = await this.sdk
      .createProduct({
        Name: productName,
        Owner: '_integration-test_',
        ProductType: 'CLOUD_FORMATION_TEMPLATE',
        Description: description,
        ProvisioningArtifactParameters: {
          DisableTemplateValidation: true,
          Info: { LoadTemplateFromURL: templateUrl },
          Type: 'CLOUD_FORMATION_TEMPLATE',
          Name: productName,
          Description: description,
        },
      })
      .promise();

    return {
      productId: response.ProductViewDetail.ProductViewSummary.ProductId,
      provisioningArtifactId: response.ProvisioningArtifactDetail.Id,
    };
  }

  async associateProductWithPortfolio(productId, portfolioId) {
    await this.sdk.associateProductWithPortfolio({ ProductId: productId, PortfolioId: portfolioId }).promise();
  }

  async disassociateProductFromPortfolio(productId, portfolioId) {
    await this.sdk.disassociateProductFromPortfolio({ ProductId: productId, PortfolioId: portfolioId }).promise();
  }

  async createConstraint(productId, portfolioId, type, roleName) {
    const response = await this.sdk
      .createConstraint({
        ProductId: productId,
        PortfolioId: portfolioId,
        Type: type,
        Parameters: JSON.stringify({ LocalRoleName: roleName }),
      })
      .promise();

    return response.ConstraintDetail.ConstraintId;
  }

  async deleteConstraint(constraintId) {
    await this.sdk.deleteConstraint({ Id: constraintId }).promise();
  }

  async deleteProduct(productId) {
    await this.sdk.deleteProduct({ Id: productId }).promise();
  }
}

// The aws javascript sdk client name
ServiceCatalog.clientName = 'ServiceCatalog';

module.exports = ServiceCatalog;
