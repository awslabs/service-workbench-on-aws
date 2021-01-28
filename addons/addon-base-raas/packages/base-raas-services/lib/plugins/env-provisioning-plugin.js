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

/**
 * A plugin method to contribute to the list of available variables for usage in variable expressions in
 * Environment Type Configurations. This plugin method just provides metadata about the variables such as list of
 * variable names and descriptions. The plugin must provide values for all the variables it claims to resolve. i.e., the
 * plugin must provide values for all the variables via the "resolve" method it claims to provide in this "list" method.
 *
 * @param requestContext The request context object containing principal (caller) information.
 * The principal's identifier object is expected to be available as "requestContext.principalIdentifier"
 * @param container Services container instance
 * @param vars An array of available variables accumulated from other plugins so far
 * @returns {Promise<{container: *, requestContext: *, vars: [{name: string, desc: string}]}>}
 */
// See addons/addon-environment-sc-api/README.md
// Called by "addons/addon-environment-sc-api/packages/environment-type-mgmt-services/lib/environment-type/env-type-config-var-service.js"
async function list({ requestContext, container, vars }) {
  const environmentConfigVarsService = await container.find('environmentConfigVarsService');
  const raasVars = await environmentConfigVarsService.list(requestContext);
  // add raas specific variables to the list
  return { requestContext, container, vars: [...vars, ...raasVars] };
}

/**
 * A plugin method to participate in providing the values for the list of available variables for usage in variable expressions in
 * Environment Type Configurations. The plugin must provide values for all the variables it claims to resolve. i.e., the
 * plugin must provide values for all the variables via this "resolve" method it claims to provide in the "list" method.
 *
 * @param requestContext The request context object containing principal (caller) information.
 * The principal's identifier object is expected to be available as "requestContext.principalIdentifier"
 * @param container Services container instance* @param resolvedVars
 * @param resolvedVars A plain javascript object containing values for variables accumulated from other plugins so far
 * @returns {Promise<{container: *, requestContext: *, resolvedVars: *}>}
 */
// Called by the environment provisioning workflow for service catalog based envs from "read-environment-info" workflow step
// See "addons/addon-environment-sc-api/packages/environment-sc-workflow-steps/lib/steps/read-environment-info/read-environment-info.js"
async function resolve({ requestContext, container, resolvedVars }) {
  const environmentConfigVarsService = await container.find('environmentConfigVarsService');
  const raasVars = await environmentConfigVarsService.resolveEnvConfigVars(requestContext, resolvedVars);
  return {
    requestContext,
    container,
    resolvedVars: {
      ...(resolvedVars || {}),
      ...raasVars,
    },
  };
}

/**
 * A plugin method to contribute to the list of default tags to apply to the environment stack being provisioned.
 * These tags are applied automatically in addition to the ones specified explicitly by the administrator when creating the
 * environment type configuration.
 *
 * @param requestContext The request context object containing principal (caller) information.
 * The principal's identifier object is expected to be available as "requestContext.principalIdentifier"
 * @param container Services container instance* @param resolvedVars
 * @param resolvedVars A plain javascript object containing values for all variables accumulated from all registered plugins
 * @param tags An array of default tags accumulated from other plugins so far
 * @returns {Promise<{container: *, requestContext: *, resolvedVars: *, tags: {Value: string, Key: string}[]}>}
 */
// Called by the environment provisioning workflow for service catalog based envs from "launch-product" workflow step
// See "addons/addon-environment-sc-api/packages/environment-sc-workflow-steps/lib/steps/launch-product/launch-product.js"
async function getDefaultTags({ requestContext, container, resolvedVars, tags }) {
  const environmentConfigVarsService = await container.find('environmentConfigVarsService');
  const raasTags = await environmentConfigVarsService.getDefaultTags(requestContext, resolvedVars);
  const result = {
    requestContext,
    container,
    resolvedVars,
    tags: [...(tags || []), ...raasTags],
  };
  return result;
}

/**
 * Plugin method that for updating environment status information in the database
 *
 * @param requestContext The request context object containing principal (caller) information.
 * The principal's identifier object is expected to be available as "requestContext.principalIdentifier"
 * @param container Services container instance* @param resolvedVars
 * @param resolvedVars A plain javascript object containing values for all variables accumulated from all registered plugins
 * @param status Status of the AWS Service Catalog Product corresponding to the launched environment
 * @param error Error if the environment provisioning failed for some reason. This may be undefined in case of successful launch.
 * @param outputs AWS CloudFormation Stack Outputs corresponding to the launched environment
 * @param provisionedProductId ID of the corresponding AWS Service Catalog Provisioned Product
 * @returns {Promise<*>}
 */
// Called by the environment provisioning workflow for service catalog based envs from "launch-product" workflow step.
// This step calls "onEnvOnProvisioningSuccess" method on the plugin upon successful product launch.
// See "addons/addon-environment-sc-api/packages/environment-sc-workflow-steps/lib/steps/launch-product/launch-product.js"
async function updateEnvOnProvisioningSuccess({
  requestContext,
  container,
  resolvedVars,
  status,
  outputs,
  provisionedProductId,
}) {
  const environmentScService = await container.find('environmentScService');
  const envId = resolvedVars.envId;

  const existingEnvRecord = await environmentScService.mustFind(requestContext, { id: envId, fields: ['rev'] });

  // Create DNS record for RStudio workspaces
  const connectionType = _.find(outputs, o => o.OutputKey === 'MetaConnection1Type');
  let connectionTypeValue;
  if (connectionType) {
    connectionTypeValue = connectionType.OutputValue;
    if (connectionTypeValue.toLowerCase() === 'rstudio') {
      const dnsName = _.find(outputs, o => o.OutputKey === 'Ec2WorkspaceDnsName').OutputValue;
      const environmentDnsService = await container.find('environmentDnsService');
      await environmentDnsService.createRecord('rstudio', envId, dnsName);
    }
  }

  const environment = {
    id: envId,
    rev: existingEnvRecord.rev || 0,
    status,
    outputs,
    provisionedProductId,
    inWorkflow: 'false',
  };
  await environmentScService.update(requestContext, environment);

  return { requestContext, container, resolvedVars, status, outputs, provisionedProductId };
}
// This step calls "onEnvOnProvisioningFailure" in case of any errors.
async function updateEnvOnProvisioningFailure({
  requestContext,
  container,
  resolvedVars,
  status,
  error,
  outputs,
  provisionedProductId,
}) {
  const environmentScService = await container.find('environmentScService');
  const envId = resolvedVars.envId;

  const existingEnvRecord = await environmentScService.mustFind(requestContext, { id: envId, fields: ['rev'] });

  const environment = {
    id: envId,
    rev: existingEnvRecord.rev || 0,
    status,
    outputs,
    provisionedProductId,
  };
  if (error) {
    environment.error = error.message;
  }
  await environmentScService.update(requestContext, environment);

  return { requestContext, container, resolvedVars, status, error, outputs, provisionedProductId };
}

/**
 * Plugin method that for updating environment status information in the database
 *
 * @param requestContext The request context object containing principal (caller) information.
 * The principal's identifier object is expected to be available as "requestContext.principalIdentifier"
 * @param container Services container instance* @param resolvedVars
 * @param resolvedVars A plain javascript object containing values for all variables accumulated from all registered plugins
 * @param status Status of the AWS Service Catalog Product corresponding to the launched environment
 * @param error Error if the environment provisioning failed for some reason. This may be undefined in case of successful launch.
 * @param envId Id of the environment
 * @param record Response from the AWS Service Catalog DescribeRecord API for the termination record.
 * See shape of the response at https://docs.aws.amazon.com/servicecatalog/latest/dg/API_DescribeRecord.html.
 * Or https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/ServiceCatalog.html#describeRecord-property.
 * This may be undefined when terminate was called on an environment that was never launched via AWS Service Catalog.
 * This can happen when the environment launch fails before we attempt to provision it using AWS Service Catalog and
 * then the user tries to terminate that environment that was never provisioned via AWS Service Catalog.
 *
 * @returns {Promise<*>}
 */
// Called by the environment termination workflow for service catalog based envs from "terminate-product" workflow step.
//
// The "terminate-product" calls "onEnvTerminationSuccess" method on the plugin upon successful termination
// See "addons/addon-environment-sc-api/packages/environment-sc-workflow-steps/lib/steps/terminate-product/terminate-product.js"
async function updateEnvOnTerminationSuccess({ requestContext, container, status, envId, record }) {
  const log = await container.find('log');
  const environmentScService = await container.find('environmentScService');

  const existingEnvRecord = await environmentScService.mustFind(requestContext, {
    id: envId,
    fields: ['rev', 'outputs'],
  });

  log.debug({ msg: `Updating environment record after successful termination`, envId });
  // -- Update environment record status in the DB
  const environment = {
    id: envId,
    rev: existingEnvRecord.rev || 0,
    status,
    inWorkflow: 'false',
  };
  const updatedEnvironment = await environmentScService.update(requestContext, environment, { action: 'REMOVE' });

  // -- Perform all required clean up
  // --- Cleanup - Resource policies (such as S3 bucket policy, KMS key policy etc) in central account
  log.debug({ msg: `Cleaning up local resource policies`, envId });

  // Delete DNS record for RStudio workspaces
  await rstudioCleanup(requestContext, updatedEnvironment, container);

  const indexesService = await container.find('indexesService');
  const { awsAccountId } = await indexesService.mustFind(requestContext, { id: updatedEnvironment.indexId });
  const environmentMountService = await container.find('environmentMountService');

  const { s3Prefixes, databases } = await environmentMountService.getStudyAccessInfo(
    requestContext,
    updatedEnvironment.studyIds,
    updatedEnvironment.createdAt,
  );

  if (s3Prefixes.length > 0) {
    await environmentMountService.removeRoleArnFromLocalResourcePolicies(
      `arn:aws:iam::${awsAccountId}:root`,
      s3Prefixes,
      databases,
    );
  }

  // --- Cleanup - EC2 KeyPairs (the main admin key created specifically for this environment for SSH or RDP) from other account
  log.debug({ msg: `Cleaning up admin key pairs`, envId });
  const environmentScKeypairService = await container.find('environmentScKeypairService');
  await environmentScKeypairService.delete(requestContext, envId);

  return { requestContext, container, status, envId, record };
}

// This method checks if the environment being terminated is an RStudio.
// If yes, this will delete the CNAME record in Route 53 service and the
// SSM public kay parameter created during environment's provisioning
async function rstudioCleanup(requestContext, updatedEnvironment, container) {
  const connectionType = _.find(updatedEnvironment.outputs, o => o.OutputKey === 'MetaConnection1Type');
  let connectionTypeValue;
  if (connectionType) {
    connectionTypeValue = connectionType.OutputValue;
    if (connectionTypeValue.toLowerCase() === 'rstudio') {
      const dnsName = _.find(updatedEnvironment.outputs, x => x.OutputKey === 'Ec2WorkspaceDnsName').OutputValue;
      const instanceId = _.find(updatedEnvironment.outputs, x => x.OutputKey === 'Ec2WorkspaceInstanceId').OutputValue;
      const environmentDnsService = await container.find('environmentDnsService');
      const environmentScService = await container.find('environmentScService');
      await environmentDnsService.deleteRecord('rstudio', updatedEnvironment.id, dnsName);

      const ssm = await environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id: updatedEnvironment.id },
        { clientName: 'SSM', options: { apiVersion: '2014-11-06' } },
      );
      await ssm
        .deleteParameter({ Name: `/rstudio/publickey/sc-environments/ec2-instance/${instanceId}` })
        .promise()
        .catch(e => {
          // Nothing to do if ParameterNotFound, rethrow any other errors
          if (e.code !== 'ParameterNotFound') {
            throw e;
          }
        });
    }
  }
}

// The "terminate-product' workflow call "onEnvTerminationFailure" in case of any errors
async function updateEnvOnTerminationFailure({ requestContext, container, status, error, envId, record }) {
  const environmentScService = await container.find('environmentScService');

  const existingEnvRecord = await environmentScService.mustFind(requestContext, { id: envId, fields: ['rev'] });
  const environment = {
    id: envId,
    rev: existingEnvRecord.rev || 0,
    status,
  };
  if (error) {
    environment.error = error.message;
  }
  await environmentScService.update(requestContext, environment);

  return { requestContext, container, status, error, envId, record };
}

const plugin = {
  list,
  resolve,
  getDefaultTags,
  onEnvProvisioningSuccess: updateEnvOnProvisioningSuccess,
  onEnvProvisioningFailure: updateEnvOnProvisioningFailure,
  onEnvTerminationSuccess: updateEnvOnTerminationSuccess,
  onEnvTerminationFailure: updateEnvOnTerminationFailure,
};

module.exports = plugin;
