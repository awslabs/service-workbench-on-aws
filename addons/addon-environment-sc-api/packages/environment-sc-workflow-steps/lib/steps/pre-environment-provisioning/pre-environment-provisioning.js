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

const pluginConstants = {
  extensionPoint: 'env-provisioning',
};

/**
 * Workflow step that enables plugins (via extension point "env-provisioning") to perform pre environment
 * provisioning tasks (if needed)
 */
class PreEnvironmentProvisioning extends StepBase {
  async start() {
    const [requestContext, envId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.string(inPayloadKeys.envId),
    ]);

    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);

    try {
      await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvPreProvisioning', {
        payload: {
          requestContext,
          container: this.container,
          envId,
        },
      });
    } catch (error) {
      this.printError(error);

      // Give all plugins a chance to react to environment pre creation having failed
      await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvPreProvisioningFailure', {
        payload: {
          requestContext,
          container: this.container,
          envId,
          status: environmentStatusEnum.FAILED,
          error,
        },
      });

      throw error;
    }
  }
}

module.exports = PreEnvironmentProvisioning;
