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
const StepBase = require('@aws-ee/base-workflow-core/lib/workflow/helpers/step-base');
const {
  getServiceCatalogClient,
} = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-service-catalog-helper');
const { paginatedList, paginatedFind } = require('@aws-ee/base-services/lib/helpers/utils');
const environmentStatusEnum = require('../../helpers/environment-status-enum');

const inPayloadKeys = {
  requestContext: 'requestContext',
  resolvedVars: 'resolvedVars',
  envTypeId: 'envTypeId',
};

const outPayloadKeys = {
  launchConstraintRole: 'launchConstraintRole',
  portfolioId: 'portfolioId',
  productId: 'productId',
};

const settingKeys = {
  envMgmtRoleArn: 'envMgmtRoleArn',
};

const pluginConstants = {
  extensionPoint: 'env-provisioning',
};

/**
 * Workflow step that replicates (clones) the launch configuration AWS IAM role and it's permissions in the target account
 * where the environment is being launched for the specified environment type and environment configuration.
 * The replicated role is eventually assumed by the AWS Service Catalog before calling AWS CloudFormation for creating
 * the CloudFormation stack for the environment.
 */
class ReplicateLaunchConstraintInTargetAcc extends StepBase {
  inputKeys() {
    return {
      [inPayloadKeys.requestContext]: 'object',
      [inPayloadKeys.resolvedVars]: 'object',
      [inPayloadKeys.envTypeId]: 'string',
    };
  }

  outputKeys() {
    return {
      [outPayloadKeys.launchConstraintRole]: 'string',
      [outPayloadKeys.portfolioId]: 'string',
      [outPayloadKeys.productId]: 'string',
    };
  }

  async start() {
    const [requestContext, resolvedVars, envTypeId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.payloadOrConfig.string(inPayloadKeys.envTypeId),
    ]);

    const [envTypeService, aws, iamService] = await this.mustFindServices(['envTypeService', 'aws', 'iamService']);
    const envType = await envTypeService.mustFind(requestContext, { id: envTypeId });

    // Get AWS Service Catalog Product Id mapped the the given environment type
    const productId = _.get(envType, 'product.productId');

    const envMgmtRoleArn = this.settings.get(settingKeys.envMgmtRoleArn);
    const serviceCatalogClient = await getServiceCatalogClient(aws, envMgmtRoleArn);

    // Make sure there is exactly only one launch path for this product
    await this.assertExactlyOneLaunchPath(serviceCatalogClient, productId, envMgmtRoleArn);

    // Find launch constraint role name on the product for portfolio/product relationship
    const portfolio = await this.findPortfolio(serviceCatalogClient, productId, envMgmtRoleArn);
    const portfolioId = portfolio.Id;
    const launchConstraintRoleName = await this.findLaunchConstraintRoleName(
      serviceCatalogClient,
      portfolioId,
      productId,
    );

    // If "xAccEnvMgmtRoleArn" is available in the resolved variables
    // (from previous workflow steps) then use that role or use the local environment management role
    const xAccEnvMgmtRoleArn = resolvedVars.xAccEnvMgmtRoleArn || envMgmtRoleArn;
    const externalId = resolvedVars.externalId;

    // Clone the launch constraint role from source account to target account with same name and permissions
    const iamClientForSrcAcc = await aws.getClientSdkForRole({
      roleArn: envMgmtRoleArn,
      clientName: 'IAM',
      options: { apiVersion: '2010-05-08' },
    });
    const iamClientForTargetAcc = await aws.getClientSdkForRole({
      roleArn: xAccEnvMgmtRoleArn,
      clientName: 'IAM',
      options: { apiVersion: '2010-05-08' },
      externalId,
    });
    await iamService.cloneRole(launchConstraintRoleName, iamClientForSrcAcc, iamClientForTargetAcc);

    // Output the launch constraint role and portfolio id
    await this.payload.setKey(outPayloadKeys.launchConstraintRole, launchConstraintRoleName);
    await this.payload.setKey(outPayloadKeys.portfolioId, portfolioId);
    await this.payload.setKey(outPayloadKeys.productId, productId);
  }

  // ------------------ PRIVATE METHODS ----------------- //

  async assertExactlyOneLaunchPath(serviceCatalogClient, productId, roleArn) {
    const result = await serviceCatalogClient.listLaunchPaths({ ProductId: productId }).promise();
    // expecting the product to be available to the platform via exactly
    // one portfolio i.e., it needs to have exactly one launch path
    if (_.isEmpty(result.LaunchPathSummaries)) {
      throw new Error(`The product ${productId} is not shared with the ${roleArn} role.`);
    }
    if (result.LaunchPathSummaries.length > 1) {
      throw new Error(
        `The product ${productId} is shared via multiple portfolios, do not know which portfolio to launch from. Please make sure the product is shared to ${roleArn} via only one portfolio.`,
      );
    }
  }

  async findPortfolio(serviceCatalogClient, productId, roleArn) {
    /*
      Pseudo Code:
      - Find all portfolios for the given product
      - For each portfolio find list of principles it's shared with
      - Filter the portfolios that are shared with the given roleArn. Expecting exactly one.
    */

    /**
     * Checks if the AWS Service Catalog portfolio identified by "portfolioId" is shared with the AWS IAM role
     * identified by the "roleArn"
     *
     * @param portfolioId
     * @returns {Promise<boolean>}
     */
    const isPortfolioSharedWithRole = async portfolioId => {
      const listingFn = async pageToken => {
        // Get principals that the portfolio is shared with
        const { Principals: list, NextPageToken: nextPageToken } = await serviceCatalogClient
          .listPrincipalsForPortfolio({
            PortfolioId: portfolioId,
            PageToken: pageToken,
          })
          .promise();
        return { list, nextPageToken };
      };
      const predicate = p => p.PrincipalARN === roleArn;

      // Convert object to boolean and return the flag
      return !!(await paginatedFind(listingFn, predicate));
    };

    /**
     * Finds AWS Service Catalog Portfolios accessible by the IAM role identified by "roleArn" for the product
     * identified by "productId"
     *
     * @param pageToken
     * @returns {Promise<[*]>}
     */
    const findAccessiblePortfoliosForProduct = async pageToken => {
      const { PortfolioDetails, NextPageToken } = await serviceCatalogClient
        .listPortfoliosForProduct({
          ProductId: productId,
          PageToken: pageToken,
        })
        .promise();
      const portfolios = await Promise.all(
        _.map(PortfolioDetails, async portfolio => {
          return {
            portfolio,
            isShared: await isPortfolioSharedWithRole(portfolio.Id),
          };
        }),
      );

      let accessiblePortfolios = _.map(_.filter(portfolios, { isShared: true }), p => p.portfolio);
      // If no accessible portfolio found and if there are more pages then search through remaining pages
      if (_.isEmpty(accessiblePortfolios) && NextPageToken) {
        accessiblePortfolios = await findAccessiblePortfoliosForProduct(NextPageToken);
      }
      return accessiblePortfolios;
    };

    // Find portfolios that the product is accessible through to the role
    const portfolios = await findAccessiblePortfoliosForProduct();

    // expecting the product to be available to the platform via exactly one portfolio
    if (_.isEmpty(portfolios)) {
      throw new Error(`The product ${productId} is not shared with the ${roleArn} role.`);
    }
    if (portfolios.length > 1) {
      throw new Error(
        `The product ${productId} is shared via multiple portfolios [${_.join(
          _.map(portfolios, 'Id'),
          ', ',
        )}], do not know which portfolio to launch from. Please make sure the product is shared to ${roleArn} via only one portfolio.`,
      );
    }

    return portfolios[0];
  }

  async findLaunchConstraintRoleName(serviceCatalogClient, portfolioId, productId) {
    /*
      Pseudo Code:
        - Find launch constraint (constraint of type "LAUNCH") for the portfolio
        - Describe launch constraint to get details.
        - Read ConstraintParameters from the launch constraint details to find the launch constraint role name.
     */

    const listingFn = async pageToken => {
      const { ConstraintDetails: list, NextPageToken: nextPageToken } = await serviceCatalogClient
        .listConstraintsForPortfolio({
          PortfolioId: portfolioId,
          ProductId: productId,
          PageToken: pageToken,
        })
        .promise();
      return { list, nextPageToken };
    };
    const constraints = await paginatedList(listingFn);
    const launchConstraints = _.filter(constraints, c => c.Type === 'LAUNCH');
    // Expecting exactly one launch constraint
    // AWS Service Catalog does not allow multiple launch constraints on the same portfolio so no need to check
    // for launchConstraints.length > 1 just make sure it's not empty
    if (_.isEmpty(launchConstraints)) {
      throw new Error(
        `The portfolio ${portfolioId} does not have any launch constraint role specified. Please specify a local role name as launch constraint`,
      );
    }

    const launchConstraint = launchConstraints[0];
    const { ConstraintParameters: constraintParameters } = await serviceCatalogClient
      .describeConstraint({
        Id: launchConstraint.ConstraintId,
      })
      .promise();
    // The ConstraintParameters is JSON string such as '{"LocalRoleName":"test-admin-role-for-sc"}'
    const { LocalRoleName: localRoleName } = JSON.parse(constraintParameters);
    if (!localRoleName) {
      throw new Error(
        `The portfolio ${portfolioId} has incorrect launch constraint specified. Make sure a local role name is specified as launch constraint for the portfolio.`,
      );
    }
    return localRoleName;
  }

  /**
   * Method to perform tasks upon some error. The method calls "onEnvProvisioningFailure" method on plugins registered for the extension point "env-provisioning"
   * @returns {Promise<*>}
   */
  async onFail(error) {
    this.printError(error);
    const [requestContext, resolvedVars] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
    ]);

    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);
    // Give all plugins a chance to react (such as updating database etc) to environment creation having failed
    await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvProvisioningFailure', {
      payload: {
        requestContext,
        container: this.container,
        resolvedVars,
        status: environmentStatusEnum.FAILED,
        error,
      },
    });
  }
}
module.exports = ReplicateLaunchConstraintInTargetAcc;
