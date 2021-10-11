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
const { v4: uuid } = require('uuid');

const StepBase = require('@aws-ee/base-workflow-core/lib/workflow/helpers/step-base');
const {
  getServiceCatalogClient,
} = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-service-catalog-helper');

const environmentStatusEnum = require('../../helpers/environment-status-enum');

const inPayloadKeys = {
  requestContext: 'requestContext',
  envId: 'envId',
  envName: 'envName',
  xAccEnvMgmtRoleArn: 'xAccEnvMgmtRoleArn',
  externalId: 'externalId',
  provisionedProductId: 'provisionedProductId',
};
const settingKeys = {
  envMgmtRoleArn: 'envMgmtRoleArn',
  enableEgressStore: 'enableEgressStore',
};

const pluginConstants = {
  extensionPoint: 'env-provisioning',
};

const failureStatuses = ['FAILED', 'IN_PROGRESS_IN_ERROR'];
const successStatuses = ['SUCCEEDED'];

class TerminateProduct extends StepBase {
  inputKeys() {
    return {
      [inPayloadKeys.requestContext]: 'object',
      [inPayloadKeys.provisionedProductId]: 'string',
    };
  }

  async start() {
    const [provisionedProductId, envId] = await Promise.all([
      this.payloadOrConfig.optionalString(inPayloadKeys.provisionedProductId, ''),
      this.payloadOrConfig.string(inPayloadKeys.envId),
    ]);

    if (provisionedProductId) {
      // The "provisionedProductId" may be empty here in cases when the environment launch had resulted in error
      // before it can be attempted to be provisioned via AWS Service Catalog
      const targetScClient = await this.getScClientForTargetAccount();
      const { RecordDetail: recordDetail } = await targetScClient
        .terminateProvisionedProduct({
          ProvisionedProductId: provisionedProductId,
          TerminateToken: uuid(),
        })
        .promise();
      this.state.setKey('RECORD_ID', recordDetail.RecordId);
    }

    const enableEgressStore = this.settings.getBoolean(settingKeys.enableEgressStore);
    if (enableEgressStore) {
      const dataEgressService = await this.mustFindServices('dataEgressService');
      await dataEgressService.deleteMainAccountEgressStoreRole(envId);
    }

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
   * This method checks for the status of the AWS Service Catalog Product being terminated and returns true when the
   * provisioned product stack has been terminated successfully. If the stack encountered any errors, the method throws an
   * error.
   *
   * @returns {Promise<boolean>}
   */
  async shouldResumeWorkflow() {
    const [envId, envName, recordId] = await Promise.all([
      this.payloadOrConfig.string(inPayloadKeys.envId),
      this.payloadOrConfig.string(inPayloadKeys.envName),
      this.state.optionalString('RECORD_ID'),
    ]);

    if (!recordId) {
      // Resume workflow right away if we did not have to call AWS Service Catalog to terminate provisioned product
      return true;
    }

    const targetScClient = await this.getScClientForTargetAccount();
    const { RecordDetail: recordDetail } = await targetScClient.describeRecord({ Id: recordId }).promise();

    const toErrorMessage = recordErrors =>
      _.join(
        _.map(recordErrors, e => `[${e.Code}] - ${e.Description}`),
        ', ',
      );

    if (_.includes(failureStatuses, recordDetail.Status)) {
      // If terminating failed then throw error, any unhandled workflow errors
      // are handled in "onFail" method
      throw new Error(
        `Error terminating environment ${envName} with id ${envId}. Reason: ${toErrorMessage(
          recordDetail.RecordErrors,
        )}`,
      );
    }

    if (_.includes(successStatuses, recordDetail.Status)) {
      // If the terminating completed successfully then return true to resume workflow
      return true;
    }

    // Return false to continue waiting for the product termination to complete
    return false;
  }

  /**
   * Method to perform tasks after the environment termination is completed successfully.
   * The method calls "onEnvTerminationSuccess" method on plugins registered for the extension point "env-provisioning"
   * @returns {Promise<*>}
   */
  async onSuccessfulCompletion() {
    const [requestContext, envId, recordId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.string(inPayloadKeys.envId),
      this.state.optionalString('RECORD_ID'),
    ]);

    let record;
    if (recordId) {
      const targetScClient = await this.getScClientForTargetAccount();
      record = await targetScClient.describeRecord({ Id: recordId }).promise();
    }

    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);

    // Give all plugins a chance to react (such as updating database etc) to environment termination being completed successfully
    await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvTerminationSuccess', {
      payload: {
        requestContext,
        container: this.container,
        status: environmentStatusEnum.TERMINATED,
        envId,
        record,
      },
    });
  }

  /**
   * Method to perform tasks upon some error, includes cases when environment termination is completed with error(s).
   * The method calls "onEnvTerminationFailure" method on plugins registered for the extension point "env-provisioning"
   * @returns {Promise<*>}
   */
  async onFail(error) {
    this.printError(error);

    const [requestContext, envId, recordId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.string(inPayloadKeys.envId),
      this.state.optionalString('RECORD_ID'),
    ]);

    let record;
    if (recordId) {
      const targetScClient = await this.getScClientForTargetAccount();
      record = await targetScClient.describeRecord({ Id: recordId }).promise();
    }

    const [pluginRegistryService] = await this.mustFindServices(['pluginRegistryService']);

    // Give all plugins a chance to react (such as updating database etc) to environment creation having failed
    await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvTerminationFailure', {
      payload: {
        requestContext,
        container: this.container,
        status: environmentStatusEnum.TERMINATING_FAILED,
        error,
        envId,
        record,
      },
    });
  }

  async reportTimeout() {
    const [envId, envName, provisionedProductId] = await Promise.all([
      this.payloadOrConfig.string(inPayloadKeys.envId),
      this.payloadOrConfig.string(inPayloadKeys.envName),
      this.payloadOrConfig.optionalString(inPayloadKeys.provisionedProductId),
    ]);
    throw new Error(
      provisionedProductId
        ? `Error terminating environment "${envName}" with id "${envId}". The workflow timed-out because the AWS Service Catalog Product "${provisionedProductId}" did not ` +
          `terminate within the timeout period of 15 days.`
        : `Error terminating environment "${envName}" with id "${envId}". The workflow timed-out because the environment did not ` +
          `terminate within the timeout period of 15 days.`,
    );
  }

  async onPass() {
    // this method is automatically invoked by the workflow engine when the step is completed
  }

  /**
   * Returns AWS Service Catalog Client for the target account where environment is running
   * @returns {Promise<{*}>}
   */
  async getScClientForTargetAccount() {
    const [xAccEnvMgmtRoleArnFromPayLoad, externalId] = await Promise.all([
      await this.payloadOrConfig.string(inPayloadKeys.xAccEnvMgmtRoleArn),
      await this.payloadOrConfig.string(inPayloadKeys.externalId),
    ]);
    const envMgmtRoleArn = this.settings.get(settingKeys.envMgmtRoleArn);
    const targetAccRoleArn = xAccEnvMgmtRoleArnFromPayLoad || envMgmtRoleArn;
    this.print({
      msg: `Creating AWS Service Catalog Client by assuming role = ${targetAccRoleArn}`,
      targetAccRoleArn,
    });

    const [aws] = await this.mustFindServices(['aws']);
    return getServiceCatalogClient(aws, targetAccRoleArn, externalId);
  }
}

module.exports = TerminateProduct;
