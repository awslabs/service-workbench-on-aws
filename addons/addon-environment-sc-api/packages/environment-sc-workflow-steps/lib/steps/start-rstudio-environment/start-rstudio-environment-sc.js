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

const settingKeys = {
  isAppStreamEnabled: 'isAppStreamEnabled',
};

class StartRStudioEnvironmentSc extends StepBase {
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
    if (!['PENDING', 'RUNNING'].includes(status)) {
      if (status !== 'STOPPED') {
        throw new Error(`EC2 instance [${instanceId}] is not stopped`);
      }
      try {
        await ec2.startInstances(params).promise();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('start ec2 instance error: ', error);
        throw error;
      }
    }
    await this.updateEnvironment({ status: 'STARTING', inWorkflow: 'true' });
    this.state.setKey('STATE_INSTANCE_ID', instanceId);

    return this.wait(5)
      .maxAttempts(120)
      .until('checkInstanceStarted')
      .thenCall('updateEnvironmentStatusAndIp');
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
      const paramsForDescribe = { ...params, IncludeAllInstances: true };
      instanceStatusInfo = await ec2.describeInstanceStatus(paramsForDescribe).promise();
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

  async getExistingEnvironmentRecord() {
    const environmentScService = await this.mustFindServices('environmentScService');
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');
    return environmentScService.mustFind(requestContext, { id });
  }

  getOutputValue(outputs, outputKey) {
    let outputValue;
    outputs.forEach(output => {
      if (output.OutputKey === outputKey) {
        outputValue = output.OutputValue;
      }
    });
    return outputValue;
  }

  updateOutputValue(outputs, outputKey, updatedOutputValue) {
    outputs.forEach(output => {
      if (output.OutputKey === outputKey) {
        output.OutputValue = updatedOutputValue;
      }
    });
  }

  async updateEnvironmentStatusAndIp() {
    const ec2 = await this.getEc2Service();
    const existingEnvRecord = await this.getExistingEnvironmentRecord();
    const outputs = existingEnvRecord.outputs;
    const instanceId = this.getOutputValue(outputs, 'Ec2WorkspaceInstanceId');
    const oldDnsName = this.getOutputValue(outputs, 'Ec2WorkspaceDnsName');

    const currentEC2Info = await ec2.describeInstances({ InstanceIds: [instanceId] }).promise();
    const newDnsName = _.get(currentEC2Info, 'Reservations[0].Instances[0].PublicDnsName');
    const publicIpAddress = _.get(currentEC2Info, 'Reservations[0].Instances[0].PublicIpAddress');
    this.updateOutputValue(outputs, 'Ec2WorkspacePublicIp', publicIpAddress);
    this.updateOutputValue(outputs, 'Ec2WorkspaceDnsName', newDnsName);

    const envId = await this.state.string('STATE_ENVIRONMENT_ID');
    // Update CNAME record for older version of Rstudio
    const connectionType = _.find(outputs, o => o.OutputKey === 'MetaConnection1Type');
    let connectionTypeValue;
    if (connectionType) {
      connectionTypeValue = connectionType.OutputValue;
      if (connectionTypeValue.toLowerCase() === 'rstudio') {
        await this.updateCnameRecords(envId, oldDnsName, newDnsName);
      }
    }

    return this.updateEnvironment(
      { status: 'COMPLETED', outputs, inWorkflow: 'false' },
      { action: 'ADD', ip: publicIpAddress },
    );
  }

  async updateCnameRecords(envId, oldDnsName, newDnsName) {
    const environmentDnsService = await this.mustFindServices('environmentDnsService');
    if (!this.settings.getBoolean(settingKeys.isAppStreamEnabled)) {
      await environmentDnsService.deleteRecord('rstudio', envId, oldDnsName);
      await environmentDnsService.createRecord('rstudio', envId, newDnsName);
    }
  }

  async updateEnvironment(updatedAttributes, ipAllowListAction = {}) {
    const environmentScService = await this.mustFindServices('environmentScService');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');
    const existingEnvRecord = await this.getExistingEnvironmentRecord();

    // SECURITY NOTE
    // add field to authorize update on behalf of user
    // this is needed to allow shared envirnments to start/stop by other users
    requestContext.fromWorkflow = true;

    const newEnvironment = {
      id: existingEnvRecord.id,
      rev: existingEnvRecord.rev || 0,
      ...updatedAttributes,
    };
    await environmentScService.update(requestContext, newEnvironment, ipAllowListAction);
  }

  async onFail() {
    return this.updateEnvironment({ status: 'STARTING_FAILED', inWorkflow: 'false' });
  }
}

module.exports = StartRStudioEnvironmentSc;
