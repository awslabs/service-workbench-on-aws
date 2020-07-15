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

const StepBase = require('@aws-ee/base-workflow-core/lib/workflow/helpers/step-base');
const environmentStatusEnum = require('../../helpers/environment-status-enum');

const inPayloadKeys = {
  requestContext: 'requestContext',
  envId: 'envId',
  envTypeId: 'envTypeId',
  envTypeConfigId: 'envTypeConfigId',
};

const outPayloadKeys = {
  resolvedVars: 'resolvedVars',
};
const pluginConstants = {
  extensionPoint: 'env-provisioning',
};

/**
 * Workflow step that reads environment type configuration variables by calling registered plugins for extension point
 * "env-provisioning"
 */
class ReadEnvironmentInfo extends StepBase {
  async start() {
    const [requestContext, envId, envTypeId, envTypeConfigId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.string(inPayloadKeys.envId),
      this.payloadOrConfig.string(inPayloadKeys.envTypeId),
      this.payloadOrConfig.string(inPayloadKeys.envTypeConfigId),
    ]);

    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);

    // Give all plugins a chance to contribute to variables resolution
    const initialResolvedVars = { envId, envTypeId, envTypeConfigId };

    try {
      const result = await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'resolve', {
        payload: {
          requestContext,
          container: this.container,
          resolvedVars: initialResolvedVars,
        },
      });

      const resolvedVars = result ? result.resolvedVars : initialResolvedVars;

      // This puts the key/value pair in the payload object for other steps to use
      await this.payload.setKey(outPayloadKeys.resolvedVars, resolvedVars);
    } catch (error) {
      this.printError(error);

      // Give all plugins a chance to react (such as updating database etc) to environment creation having failed
      await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvProvisioningFailure', {
        payload: {
          requestContext,
          container: this.container,
          resolvedVars: initialResolvedVars,
          status: environmentStatusEnum.FAILED,
          error,
        },
      });

      throw error;
    }
  }

  inputKeys() {
    return {
      [inPayloadKeys.requestContext]: 'object',
      [inPayloadKeys.envId]: 'string',
      [inPayloadKeys.envTypeId]: 'string',
      [inPayloadKeys.envTypeConfigId]: 'string',
    };
  }

  outputKeys() {
    return {
      [outPayloadKeys.resolvedVars]: 'object',
    };
  }
}

module.exports = ReadEnvironmentInfo;
