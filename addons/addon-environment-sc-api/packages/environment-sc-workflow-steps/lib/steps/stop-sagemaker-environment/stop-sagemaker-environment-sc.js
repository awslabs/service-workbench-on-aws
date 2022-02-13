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

class StopSagemakerEnvironmentSc extends StepBase {
  async start() {
    const environmentId = await this.payload.string('environmentId');
    this.state.setKey('STATE_ENVIRONMENT_ID', environmentId);

    const requestContext = await this.payload.object('requestContext');
    this.state.setKey('STATE_REQUEST_CONTEXT', requestContext);

    const NotebookInstanceName = await this.payload.string('instanceIdentifier');

    const sm = await this.getSageMakerService();
    const params = {
      NotebookInstanceName,
    };

    let notebookInstanceInfo;
    try {
      notebookInstanceInfo = await sm.describeNotebookInstance(params).promise();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('describe notebook instance error: ', error);
      throw error;
    }

    const { NotebookInstanceStatus: notebookInstanceStatus } = notebookInstanceInfo;
    const status = notebookInstanceStatus.toUpperCase();
    if (!['STOPPING', 'STOPPED'].includes(status)) {
      if (status !== 'INSERVICE') {
        throw new Error(`Notebook instance [${NotebookInstanceName}] is not running`);
      }

      try {
        await sm.stopNotebookInstance(params).promise();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('stop notebook instance error: ', error);
        throw error;
      }
    }

    await this.updateEnvironment({ status: 'STOPPING', inWorkflow: 'true' });

    this.state.setKey('STATE_NOTEBOOK_INSTANCE_NAME', NotebookInstanceName);

    return this.wait(5)
      .maxAttempts(120)
      .until('checkNotebookStopped')
      .thenCall('updateEnvironmentStatusToStopped');
  }

  async checkNotebookStopped() {
    const notebookInstanceName = await this.state.string('STATE_NOTEBOOK_INSTANCE_NAME');
    this.print(`Notebook instance name: [${notebookInstanceName}]`);

    const sm = await this.getSageMakerService();
    const params = {
      NotebookInstanceName: notebookInstanceName,
    };

    let notebookInstanceInfo;
    try {
      notebookInstanceInfo = await sm.describeNotebookInstance(params).promise();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('describe notebook instance error: ', error);
      // may be a transient error - return false
      return false;
    }

    const { NotebookInstanceStatus: notebookInstanceStatus } = notebookInstanceInfo;
    const status = notebookInstanceStatus.toUpperCase();

    if (status === 'FAILED') {
      throw new Error(
        `Notebook instance [${notebookInstanceName}] is in failed state with reason: ${notebookInstanceStatus.FailureReason}`,
      );
    }
    if (status === 'DELETING') {
      throw new Error(`Notebook instance [${notebookInstanceName}] is being deleted`);
    }

    return status === 'STOPPED';
  }

  async getSageMakerService() {
    const [aws] = await this.mustFindServices(['aws']);
    const [requestContext, RoleArn, ExternalId] = await Promise.all([
      this.payload.object('requestContext'),
      this.payload.string('cfnExecutionRole'),
      this.payload.string('roleExternalId'),
    ]);

    // const sts = new aws.sdk.STS();
    const sts = new aws.sdk.STS({ apiVersion: '2011-06-15', stsRegionalEndpoints: 'regional' });
    const {
      Credentials: { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken },
    } = await sts
      .assumeRole({
        RoleArn,
        RoleSessionName: `RaaS-${requestContext.principalIdentifier.username}`,
        ExternalId,
      })
      .promise();

    return new aws.sdk.SageMaker({ accessKeyId, secretAccessKey, sessionToken });
  }

  async updateEnvironmentStatusToStopped() {
    return this.updateEnvironment({ status: 'STOPPED', inWorkflow: 'false' });
  }

  async updateEnvironment(updatedAttributes) {
    const environmentScService = await this.mustFindServices('environmentScService');
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');

    const existingEnvRecord = await environmentScService.mustFind(requestContext, { id });

    // SECURITY NOTE
    // add field to authorize update on behalf of user
    // this is needed to allow shared envirnments to start/stop by other users
    requestContext.fromWorkflow = true;

    const newEnvironment = {
      id,
      rev: existingEnvRecord.rev || 0,
      ...updatedAttributes,
    };

    await environmentScService.update(requestContext, newEnvironment);
  }

  async onFail() {
    return this.updateEnvironment({ status: 'STOPPING_FAILED', inWorkflow: 'false' });
  }
}

module.exports = StopSagemakerEnvironmentSc;
