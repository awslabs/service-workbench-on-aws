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
