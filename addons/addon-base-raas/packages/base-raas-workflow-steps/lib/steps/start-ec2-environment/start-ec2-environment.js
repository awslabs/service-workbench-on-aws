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

class StartEC2Environment extends StepBase {
  async start() {
    const environmentId = await this.payload.string('environmentId');
    this.state.setKey('STATE_ENVIRONMENT_ID', environmentId);

    const requestContext = await this.payload.object('requestContext');
    this.state.setKey('STATE_REQUEST_CONTEXT', requestContext);

    const [environmentService] = await this.mustFindServices(['environmentService']);
    const environment = await environmentService.mustFind(requestContext, { id: environmentId });

    const ec2 = await this.getEc2Service();
    const { Ec2WorkspaceInstanceId } = environment.instanceInfo;

    const params = {
      InstanceIds: [Ec2WorkspaceInstanceId],
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

    if (status !== 'STOPPED') {
      throw new Error(`EC2 instance [${Ec2WorkspaceInstanceId}] is not stopped`);
    }

    try {
      await ec2.startInstances(params).promise();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('start ec2 instance error: ', error);
      throw error;
    }

    await this.updateEnvironmentStatus('STARTING');
    this.state.setKey('STATE_INSTANCE_ID', Ec2WorkspaceInstanceId);

    return this.wait(5)
      .maxAttempts(120)
      .until('checkInstanceStarted')
      .thenCall('updateEnvironmentStatusToCompleted');
  }

  async checkInstanceStarted() {
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

    if (['SHUTTING-DOWN', 'TERMINATED', 'STOPPING'].includes(status)) {
      throw new Error(`EC2 instance [${instanceId}] is in [${status}] state and can not be started`);
    }

    return status === 'RUNNING';
  }

  async getUpdatedInstanceInfo(oldInstanceInfo) {
    const ec2 = await this.getEc2Service();
    const { Ec2WorkspaceInstanceId } = oldInstanceInfo;

    const data = await ec2.describeInstances({ InstanceIds: [Ec2WorkspaceInstanceId] }).promise();

    const instanceInfo = _.get(data, 'Reservations[0].Instances[0]');

    return {
      Ec2WorkspaceDnsName: _.get(instanceInfo, 'PublicDnsName'),
      Ec2WorkspacePublicIp: _.get(instanceInfo, 'PublicIpAddress'),
    };
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

  async updateEnvironmentStatusToCompleted() {
    return this.updateEnvironmentStatus('COMPLETED');
  }

  async updateEnvironmentStatus(status) {
    const environmentService = await this.mustFindServices('environmentService');
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');

    const environment = await environmentService.mustFind(requestContext, { id: id });
    const instanceInfo = await this.getUpdatedInstanceInfo(environment.instanceInfo);

    // SECURITY NOTE
    // add field to authorize update on behalf of user
    // this is needed to allow shared envirnments to start/stop by other users
    requestContext.fromWorkflow = true;

    await environmentService.update(requestContext, { id, status, instanceInfo });
  }

  async onFail() {
    return this.updateEnvironmentStatus('STARTING_FAILED');
  }
}

module.exports = StartEC2Environment;
