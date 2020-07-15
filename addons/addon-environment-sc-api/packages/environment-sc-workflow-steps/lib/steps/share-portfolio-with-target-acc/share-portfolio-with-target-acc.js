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
const environmentStatusEnum = require('../../helpers/environment-status-enum');

const inPayloadKeys = {
  requestContext: 'requestContext',
  resolvedVars: 'resolvedVars',
  portfolioId: 'portfolioId',
};

const settingKeys = {
  envMgmtRoleArn: 'envMgmtRoleArn',
};
const pluginConstants = {
  extensionPoint: 'env-provisioning',
};

const emptyObjectIfDoesNotExist = e => {
  if (e.code === 'NoSuchEntity' || e.code === 'ResourceNotFoundException') {
    return {}; // return empty object if the entity does not exists
  }
  throw e; // for any other error let it bubble up
};

/**
 * Workflow step to share and accept the AWS Service Catalog portfolio with the target account where the environment
 * is being launched.
 */
class SharePortfolioWithTargetAcc extends StepBase {
  inputKeys() {
    return {
      [inPayloadKeys.requestContext]: 'object',
      [inPayloadKeys.resolvedVars]: 'object',
      [inPayloadKeys.portfolioId]: 'string',
    };
  }

  async start() {
    const [resolvedVars, portfolioId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.payloadOrConfig.string(inPayloadKeys.portfolioId),
    ]);
    const envMgmtRoleArn = this.settings.get(settingKeys.envMgmtRoleArn);
    const xAccEnvMgmtRoleArn = resolvedVars.xAccEnvMgmtRoleArn || envMgmtRoleArn;
    const externalId = resolvedVars.externalId;

    // The ARN of the role has the format "arn:aws:iam::<aws-account-id>:role/<role-name>"
    const toAccId = roleArn => _.split(roleArn, ':')[4];
    const srcAwsAccountId = toAccId(envMgmtRoleArn);
    const targetAwsAccountId = toAccId(xAccEnvMgmtRoleArn);
    const [aws] = await this.mustFindServices(['aws']);
    const targetScClient = await getServiceCatalogClient(aws, xAccEnvMgmtRoleArn, externalId);

    if (srcAwsAccountId === targetAwsAccountId) {
      // Source AWS Account and Target AWS Account are same. No need to share or accept the portfolio
      this.print({
        msg: `The source and the target account are same. There is not need to share the portfolio`,
        portfolioId,
        srcAwsAccountId,
        targetAwsAccountId,
      });

      // Associate account's environment management role xAccEnvMgmtRoleArn with the portfolio. This is required even
      // when source and target account are same when "xAccEnvMgmtRoleArn" is different from "envMgmtRoleArn"
      if (envMgmtRoleArn !== xAccEnvMgmtRoleArn) {
        await targetScClient
          .associatePrincipalWithPortfolio({
            PortfolioId: portfolioId,
            PrincipalARN: xAccEnvMgmtRoleArn,
            PrincipalType: 'IAM',
          })
          .promise();
      }
      return;
    }

    this.print({
      msg: `Sharing portfolio ${portfolioId} with account ${targetAwsAccountId}`,
      portfolioId,
      targetAwsAccountId,
    });

    const srcScClient = await getServiceCatalogClient(aws, envMgmtRoleArn);

    const srcPortfolio = await srcScClient
      .describePortfolio({ Id: portfolioId })
      .promise()
      .catch(emptyObjectIfDoesNotExist);
    if (_.isEmpty(srcPortfolio)) {
      throw new Error(`The portfolio ${portfolioId} does not exist.`);
    }

    // Check if the portfolio is already available in target account
    const sharedPortfolio = await targetScClient
      .describePortfolio({ Id: portfolioId })
      .promise()
      .catch(emptyObjectIfDoesNotExist);

    if (_.isEmpty(sharedPortfolio)) {
      // Portfolio is not shared with the target account yet so share it now
      await srcScClient.createPortfolioShare({ PortfolioId: portfolioId, AccountId: targetAwsAccountId }).promise();
    }

    // Accept the portfolio share in target account
    await targetScClient.acceptPortfolioShare({ PortfolioId: portfolioId, PortfolioShareType: 'IMPORTED' }).promise();

    // Associate target account's environment management role xAccEnvMgmtRoleArn with the portfolio
    await targetScClient
      .associatePrincipalWithPortfolio({
        PortfolioId: portfolioId,
        PrincipalARN: xAccEnvMgmtRoleArn,
        PrincipalType: 'IAM',
      })
      .promise();
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

module.exports = SharePortfolioWithTargetAcc;
