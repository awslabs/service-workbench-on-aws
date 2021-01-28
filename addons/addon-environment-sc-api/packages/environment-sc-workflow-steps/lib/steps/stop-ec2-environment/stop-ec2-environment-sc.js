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

class StopEc2EnvironmentSc extends StepBase {
  async start() {
    const environmentId = await this.payload.string('environmentId');
    this.state.setKey('STATE_ENVIRONMENT_ID', environmentId);

    const requestContext = await this.payload.object('requestContext');
    this.state.setKey('STATE_REQUEST_CONTEXT', requestContext);

    const instanceId = await this.payload.string('instanceIdentifier');

    const ec2 = await this.getEc2Service();

    const params = {
      InstanceIds: [instanceId],
    };

    let instanceStatusInfo;
    try {
      const paramsForDescribe = { ...params, IncludeAllInstances: true };
      instanceStatusInfo = await ec2.describeInstanceStatus(paramsForDescribe).promise();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('describe ec2 instance error: ', error);
      throw error;
    }

    const status = _.get(instanceStatusInfo, 'InstanceStatuses[0].InstanceState.Name').toUpperCase();

    if (!['STOPPING', 'STOPPED'].includes(status)) {
      if (status !== 'RUNNING') {
        throw new Error(`EC2 instance [${instanceId}] is not running`);
      }

      try {
        // This method hibernate an instance
        await ec2.stopInstances(params).promise();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('stop ec2 instance error: ', error);
        throw error;
      }
    }
    await this.updateEnvironment({ status: 'STOPPING', inWorkflow: 'true' });

    this.state.setKey('STATE_INSTANCE_ID', instanceId);

    return this.wait(5)
      .maxAttempts(120)
      .until('checkInstanceStopped')
      .thenCall('updateEnvironmentStatusToStopped');
  }

  async checkInstanceStopped() {
    const instanceId = await this.state.string('STATE_INSTANCE_ID');
    this.print(`instanceId: [${instanceId}]`);

    const ec2 = await this.getEc2Service();
    const params = {
      InstanceIds: [instanceId],
    };

    let instanceStatusInfo;
    try {
      const parmsForDescribe = { ...params, IncludeAllInstances: true };
      instanceStatusInfo = await ec2.describeInstanceStatus(parmsForDescribe).promise();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('describe ec2 instance error: ', error);
      throw error;
    }

    const status = _.get(instanceStatusInfo, 'InstanceStatuses[0].InstanceState.Name').toUpperCase();

    if (['SHUTTING-DOWN', 'TERMINATED'].includes(status)) {
      throw new Error(`EC2 instance [${instanceId}] is in ${status} state and can not be stopped`);
    }

    return status === 'STOPPED';
  }

  async getEc2Service() {
    const [aws] = await this.mustFindServices(['aws']);
    const [requestContext, RoleArn, ExternalId] = await Promise.all([
      this.payload.object('requestContext'),
      this.payload.string('cfnExecutionRole'),
      this.payload.string('roleExternalId'),
    ]);

    const sts = new aws.sdk.STS();
    const {
      Credentials: { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken },
    } = await sts
      .assumeRole({
        RoleArn,
        RoleSessionName: `RaaS-${requestContext.principalIdentifier.username}`,
        ExternalId,
      })
      .promise();

    return new aws.sdk.EC2({ accessKeyId, secretAccessKey, sessionToken });
  }

  async updateEnvironmentStatusToStopped() {
    return this.updateEnvironment({ status: 'STOPPED', inWorkflow: 'false' });
  }

  async updateEnvironment(updatedAttributes) {
    const environmentScService = await this.mustFindServices('environmentScService');
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');

    // SECURITY NOTE
    // add field to authorize update on behalf of user
    // this is needed to allow shared envirnments to start/stop by other users
    requestContext.fromWorkflow = true;
    const existingEnvRecord = await environmentScService.mustFind(requestContext, { id, fields: ['rev'] });

    const environment = {
      id,
      rev: existingEnvRecord.rev || 0,
      ...updatedAttributes,
    };
    await environmentScService.update(requestContext, environment, { action: 'REMOVE' });
  }

  async onFail() {
    return this.updateEnvironment({ status: 'STOPPING_FAILED', inWorkflow: 'false' });
  }
}

module.exports = StopEc2EnvironmentSc;
