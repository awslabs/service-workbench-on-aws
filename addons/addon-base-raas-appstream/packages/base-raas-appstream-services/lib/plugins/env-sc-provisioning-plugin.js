/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

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
  const appStreamScEnvConfigVarsService = await container.find('appStreamScEnvConfigVarsService');
  const appStreamScEnvConfigVars = await appStreamScEnvConfigVarsService.list(requestContext);
  // add AppStream Addon specific variables to the list
  return { requestContext, container, vars: [...vars, ...appStreamScEnvConfigVars] };
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
  const appStreamScEnvConfigVarsService = await container.find('appStreamScEnvConfigVarsService');
  const appStreamScEnvConfigVars = await appStreamScEnvConfigVarsService.resolveEnvConfigVars(
    requestContext,
    resolvedVars,
  );
  return {
    requestContext,
    container,
    resolvedVars: {
      ...(resolvedVars || {}),
      ...appStreamScEnvConfigVars,
    },
  };
}

const plugin = {
  list,
  resolve,
};

module.exports = plugin;
