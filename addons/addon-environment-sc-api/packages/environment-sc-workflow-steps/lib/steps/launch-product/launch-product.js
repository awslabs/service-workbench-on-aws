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
  envTypeId: 'envTypeId',
  envTypeConfigId: 'envTypeConfigId',
  resolvedVars: 'resolvedVars',
  portfolioId: 'portfolioId',
  productId: 'productId',
  needsAlb: 'needsAlb',
};
const settingKeys = {
  envMgmtRoleArn: 'envMgmtRoleArn',
};

const pluginConstants = {
  extensionPoint: 'env-provisioning',
};

const failureStatuses = ['TAINTED', 'ERROR'];
const successStatuses = ['AVAILABLE'];

const emptyObjectIfDoesNotExist = e => {
  if (e.code === 'NoSuchEntity' || e.code === 'ResourceNotFoundException') {
    return {}; // return empty object if the entity does not exists
  }
  throw e; // for any other error let it bubble up
};

class LaunchProduct extends StepBase {
  inputKeys() {
    return {
      [inPayloadKeys.requestContext]: 'object',
      [inPayloadKeys.resolvedVars]: 'object',
      [inPayloadKeys.portfolioId]: 'string',
      [inPayloadKeys.productId]: 'string',
      [inPayloadKeys.envTypeId]: 'string',
      [inPayloadKeys.envTypeConfigId]: 'string',
      [inPayloadKeys.needsAlb]: 'boolean',
    };
  }

  async start() {
    const [requestContext, resolvedVars, productId, envTypeId, envTypeConfigId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.payloadOrConfig.string(inPayloadKeys.productId),
      this.payloadOrConfig.string(inPayloadKeys.envTypeId),
      this.payloadOrConfig.string(inPayloadKeys.envTypeConfigId),
    ]);

    const [envTypeService] = await this.mustFindServices(['envTypeService']);
    const envType = await envTypeService.mustFind(requestContext, { id: envTypeId });

    // Get AWS Service Catalog Client and AWS IAM Role ARN for the target account where environment
    // is being launched
    const { targetScClient, targetAccRoleArn } = await this.getScClientAndRoleForTargetAcc(resolvedVars);

    // const envName = `${resolvedVars.name || envType.name}`;
    const datetime = Date.now();
    const stackName = `analysis-${datetime}`;

    // Set "namespace" as the stack name
    // The variable is claimed to be provided as one of the available variables to be used in variable expressions
    // in "EnvTypeConfigVarService.list" method.
    // If you change the name from "namespace" to something else, make sure to change it in
    // "EnvTypeConfigVarService.list" as well
    resolvedVars.namespace = stackName;

    const [envTypeConfigService] = await this.mustFindServices(['envTypeConfigService']);
    const envTypeConfig = await envTypeConfigService.mustFind(requestContext, envTypeId, { id: envTypeConfigId });

    // Read input params specified in the environment type configuration
    // The params may include variable expressions, resolve the expressions by using the resolveVars
    // By doing this resolution, we might overwrite the dynamic, unique value defined above with a static name
    // that would not be unique between deployments of the same workspace configuration
    const resolvedInputParams = await this.resolveVarExpressions(envTypeConfig.params, resolvedVars);
    // Additional layer to check the namespace is valid and unique. If not, make new namespace from
    // static and get index of namespace param to change
    const { namespaceParam, namespaceIndex } = this.getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime);
    if (namespaceIndex >= 0) resolvedInputParams[namespaceIndex].Value = namespaceParam;
    // Read tags specified in the environment type configuration
    // The tags may include variable expressions, resolve the expressions by using the resolveVars
    const resolvedTags = await this.resolveVarExpressions(envTypeConfig.tags, resolvedVars);
    // In addition to the custom tags specified in the env type configuration,
    // we may need to apply some other standard tags (for billing etc)
    const defaultTags = await this.getDefaultTags(requestContext, resolvedVars);
    // union and deduplicate to get effective tags to apply
    const effectiveTags = _.unionBy(resolvedTags, defaultTags, 'Key');
    // Adding tags to resolved vars so that the tags can be used on listener rule creation
    resolvedVars.tags = effectiveTags;

    // Get launch path for provisioning the product
    const launchPath = await this.getLaunchPath(targetScClient, productId, targetAccRoleArn);

    // Ready to provision product
    const params = {
      ProductId: productId,
      ProvisionedProductName: stackName,
      ProvisioningArtifactId: envType.provisioningArtifact.id,
      PathId: launchPath.Id,
      ProvisioningParameters: resolvedInputParams,
      Tags: effectiveTags,
    };
    this.print({
      msg: `Provisioning AWS Service Catalog Product ${productId}`,
      params,
    });
    const { RecordDetail: recordDetail } = await targetScClient.provisionProduct(params).promise();

    this.state.setKey('RECORD_ID', recordDetail.RecordId);
    this.state.setKey('PROVISIONED_PRODUCT_ID', recordDetail.ProvisionedProductId);
    this.state.setKey('STACK_NAME', stackName);
    return (
      this.wait(5) // check every 5 seconds
        // keep doing it for 1*1296000 seconds = 15 days
        // IMPORTANT: if you change the maxAttempts below or the wait check period of 5 seconds above
        // then make sure to adjust the error message in "reportTimeout" accordingly
        .maxAttempts(1296000)
        .until('shouldResumeWorkflow')
        .thenCall('onSuccessfulCompletion')
        .otherwiseCall('reportTimeout')
      // if anything fails, the "onFail" is called
    );
  }

  /**
   * A method to decide when to resume the workflow.
   * This method checks for the status of the AWS Service Catalog Product being provisioned and returns true when the
   * provisioned product stack has completed successfully. If the stack encountered any errors, the method throws an
   * error.
   *
   * @returns {Promise<boolean>}
   */
  async shouldResumeWorkflow() {
    const [provisionedProductId, resolvedVars] = await Promise.all([
      this.state.string('PROVISIONED_PRODUCT_ID'),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
    ]);
    const { targetScClient } = await this.getScClientAndRoleForTargetAcc(resolvedVars);
    const { ProvisionedProductDetail: provisionedProductDetail } = await targetScClient
      .describeProvisionedProduct({ Id: provisionedProductId })
      .promise();

    const envName = resolvedVars.name;
    if (_.includes(failureStatuses, provisionedProductDetail.Status)) {
      // If provisioning failed then throw error, any unhandled workflow errors
      // are handled in "onFail" method
      throw new Error(`Error provisioning environment ${envName}. Reason: ${provisionedProductDetail.StatusMessage}`);
    }

    if (_.includes(successStatuses, provisionedProductDetail.Status)) {
      // If the provisioning completed successfully then return true to resume workflow
      return true;
    }

    // Return false to continue waiting for the product provisioning to complete
    return false;
  }

  /**
   * Returns AWS Service Catalog Client and AWS IAM Role ARN for the target account where environment is being launched
   * @param resolvedVars
   * @returns {Promise<{targetScClient: *, targetAccRoleArn: string}>}
   */
  async getScClientAndRoleForTargetAcc(resolvedVars) {
    const [aws] = await this.mustFindServices(['aws']);
    const targetAccRoleArn = this.getTargetAccountRoleArn(resolvedVars);
    this.print({
      msg: `Creating AWS Service Catalog Client by assuming role = ${targetAccRoleArn}`,
      targetAccRoleArn,
    });
    const externalId = resolvedVars.externalId;
    const targetScClient = await getServiceCatalogClient(aws, targetAccRoleArn, externalId);
    return { targetScClient, targetAccRoleArn };
  }

  getTargetAccountRoleArn(resolvedVars) {
    // If "xAccEnvMgmtRoleArn" is available in the resolved variables
    // (from previous workflow steps) then use that role or use the local environment management role
    const envMgmtRoleArn = this.settings.get(settingKeys.envMgmtRoleArn);
    const xAccEnvMgmtRoleArn = resolvedVars.xAccEnvMgmtRoleArn || envMgmtRoleArn;
    return xAccEnvMgmtRoleArn;
  }

  /**
   * Method to perform tasks after the environment provisioning is completed successfully.
   * The method calls "onEnvProvisioningSuccess" method on plugins registered for the extension point "env-provisioning"
   * @returns {Promise<*>}
   */
  async onSuccessfulCompletion() {
    const [requestContext, resolvedVars, recordId, provisionedProductId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.state.string('RECORD_ID'),
      this.state.string('PROVISIONED_PRODUCT_ID'),
    ]);

    const { targetScClient } = await this.getScClientAndRoleForTargetAcc(resolvedVars);

    const { RecordOutputs: recordOutputs } = await targetScClient.describeRecord({ Id: recordId }).promise();

    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);

    // Give all plugins a chance to react (such as updating database etc) to environment creation being completed successfully
    await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvProvisioningSuccess', {
      payload: {
        requestContext,
        container: this.container,
        resolvedVars,
        status: environmentStatusEnum.COMPLETED,
        outputs: recordOutputs,
        provisionedProductId,
      },
    });
  }

  /**
   * Method to perform tasks upon some error, includes cases when environment provisioning is completed with error(s).
   * The method calls "onEnvProvisioningFailure" method on plugins registered for the extension point "env-provisioning"
   * @returns {Promise<*>}
   */
  async onFail(error) {
    this.printError(error);

    const [requestContext, resolvedVars, portfolioId, productId, provisionedProductId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.payloadOrConfig.string(inPayloadKeys.portfolioId),
      this.payloadOrConfig.string(inPayloadKeys.productId),

      // Using optionalString because PROVISIONED_PRODUCT_ID may not have been set in the state if failure occurred before calling provisionProduct
      this.state.optionalString('PROVISIONED_PRODUCT_ID', ''),
    ]);

    const targetAwsAccountId = this.getTargetAccountRoleArn(resolvedVars);
    this.print({
      msg: `Error provisioning product ${productId} from portfolio ${portfolioId} by ${targetAwsAccountId}`,
      portfolioId,
      targetAwsAccountId,
    });

    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);

    // Give all plugins a chance to react (such as updating database etc) to environment creation having failed
    await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvProvisioningFailure', {
      payload: {
        requestContext,
        container: this.container,
        resolvedVars,
        status: environmentStatusEnum.FAILED,
        error,
        provisionedProductId,
      },
    });
  }

  async reportTimeout() {
    const [stackName, resolvedVars] = await Promise.all([
      this.state.string('STACK_NAME'),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
    ]);
    const envName = resolvedVars.name;
    throw new Error(
      `Error provisioning environment "${envName}". The workflow timed-out because the stack "${stackName}" did not complete within the timeout period of 15 days.`,
    );
  }

  async onPass() {
    // this method is automatically invoked by the workflow engine when the step is completed
  }

  /**
   * Method to collect default tags that need to be applied to the product being provisioned.
   * These default tags are in addition to any custom tags specified at environment type configuration level.
   * The method collects these tags by calling "getDefaultTags" method of registered plugins via extension point
   * "env-provisioning"
   *
   * @param requestContext
   * @param resolvedVars
   *
   * @returns {Promise<{Value: string, Key: string}[]>}
   */
  async getDefaultTags(requestContext, resolvedVars) {
    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);
    // Give all plugins a chance to contribute to default tags
    const initial = [];
    const result = await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'getDefaultTags', {
      payload: {
        requestContext,
        container: this.container,
        resolvedVars,
        tags: initial,
      },
    });
    return result ? result.tags : initial;
  }

  /**
   * Method to resolve any variable expressions in the given key value pairs. The expressions may be in keys and/or values.
   *
   * @param keyValuePairs
   * @param resolvedVars
   * @returns {Promise<{Value: string, Key: string}[]>}
   */
  async resolveVarExpressions(keyValuePairs, resolvedVars) {
    const resolved = _.map(keyValuePairs, p => {
      const compiledKey = _.template(p.key);
      const resolvedKey = compiledKey(resolvedVars);

      const compiledValue = _.template(p.value);
      const resolvedValue = compiledValue(resolvedVars);
      return {
        Key: resolvedKey,
        Value: resolvedValue,
      };
    });
    return resolved;
  }

  /**
   * A private utility method to find launch paths for the given product when being launched by the specified
   * principal (roleArn)
   *
   * @param serviceCatalogClient
   * @param productId
   * @param roleArn
   *
   * @returns {Promise<{Id:string, ConstraintSummaries:Array, Tags:Array, Name:string}[]>}
   */
  async getLaunchPath(serviceCatalogClient, productId, roleArn) {
    const result = await serviceCatalogClient
      .listLaunchPaths({ ProductId: productId })
      .promise()
      .catch(emptyObjectIfDoesNotExist);
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
    return result.LaunchPathSummaries[0];
  }

  /**
   * Check if the resolved input parameter contains a static namespace param. If so, augments the namespace to begin with
   * 'analysis-' for permissions purposes (if it does not already start with that) and to end with a unique datetime string
   * so Cloudformation doesn't create duplicate stacks for separate workspaces.
   *
   * @param resolvedInputParams
   * @param datetime
   * @returns {namespaceParam:string, namespaceIndex:string}
   */
  getNamespaceAndIndexIfNecessary(resolvedInputParams, datetime) {
    const namespaceIndex = resolvedInputParams.findIndex(element => element.Key === 'Namespace');
    let namespaceParam = namespaceIndex < 0 ? '' : resolvedInputParams[namespaceIndex].Value;

    // Check to make sure the resolved namespace variable begins with 'analysis-' so our templates will allow it
    if (!namespaceParam.startsWith('analysis-')) {
      namespaceParam = `analysis-${namespaceParam}`;
    }

    // Check to make sure the resolved namespace variable ends with a unique datetime string so it will be unique for each deployment of a configuration with a static namespace
    if (namespaceParam.split('-').pop() !== datetime.toString()) {
      namespaceParam += `-${datetime}`;
    }

    return { namespaceParam, namespaceIndex };
  }
}

module.exports = LaunchProduct;
