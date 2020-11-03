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

const STACK_FAILED = [
  'CREATE_FAILED',
  'ROLLBACK_FAILED',
  'DELETE_FAILED',
  'UPDATE_ROLLBACK_FAILED',
  'ROLLBACK_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
];

const STACK_SUCCESS = ['CREATE_COMPLETE', 'DELETE_COMPLETE', 'UPDATE_COMPLETE'];

class CreateNetworkInfrastructure extends StepBase {
  async start() {
    this.print('start creating network infrastructure for storage gateway');
    const [requestContext] = await Promise.all([this.payload.object('requestContext')]);

    // Get the SSM parameter for AMI to use for Storage Gateway instance
    const ssm = await this.getSSM();
    const storageGatewayAMI = await ssm
      .getParameter({ Name: '/aws/service/storagegateway/ami/FILE_S3/latest' })
      .promise();

    // set state
    this.state.setKey('STORAGE_GATEWAY_AMI', storageGatewayAMI.Parameter.Value);
    this.state.setKey('STATE_REQUEST_CONTEXT', requestContext);
    await this.createNetworkInfra();
    return this.wait(20)
      .maxAttempts(60)
      .until('checkCfnCompleted')
      .thenCall('createStorageGateway');
  }

  async createNetworkInfra() {
    // create all the network infrastructure required for storage gateway. Note that Storage Gateway doesn't
    // have CloudFormation integration, so it's creation is being done outside of CloudFormation
    this.print('start to deploy initial stacks in newly created AWS account');
    const requestContext = await this.payload.object('requestContext');
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const userService = await this.getUserService();
    const user = await userService.mustFindUser({ uid: by });
    // deploy basic stacks to the account just created
    const [cfnTemplateService] = await this.mustFindServices(['cfnTemplateService']);
    const cfn = await this.getCloudFormationService();

    const [template] = await Promise.all([cfnTemplateService.getTemplate('storage-gateway-network-infra')]);
    const stackName = `initial-stack-${new Date().getTime()}`;
    const cfnParams = [];
    const addParam = (key, v) => cfnParams.push({ ParameterKey: key, ParameterValue: v });

    addParam('Namespace', stackName);
    addParam('AmiId', await this.state.string('STORAGE_GATEWAY_AMI'));

    const input = {
      StackName: stackName,
      Parameters: cfnParams,
      Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      TemplateBody: template,
      Tags: [
        {
          Key: 'Description',
          Value: `Created by ${user.username} for newly created AWS account`,
        },
        {
          Key: 'CreatedBy',
          Value: user.username,
        },
      ],
    };
    const response = await cfn.createStack(input).promise();

    // Update workflow state and poll for stack creation completion
    this.state.setKey('STATE_STACK_ID', response.StackId);
    this.state.setKey('USER_ID', user.username);
  }

  async checkCfnCompleted() {
    const stackId = await this.state.string('STATE_STACK_ID');
    const cfn = await this.getCloudFormationService();
    const stackInfo = (await cfn.describeStacks({ StackName: stackId }).promise()).Stacks[0];

    if (STACK_FAILED.includes(stackInfo.StackStatus)) {
      throw new Error(`Stack operation failed with message: ${stackInfo.StackStatusReason}`);
    } else if (STACK_SUCCESS.includes(stackInfo.StackStatus)) {
      // handle the case where the cloudformation is deleted before the creation could finish
      if (stackInfo.StackStatus !== 'DELETE_COMPLETE') {
        const cfnOutputs = this.getCfnOutputs(stackInfo);
        this.print(`updating stack deployed completed: ${cfnOutputs}`);
        this.state.setKey('VOLUME_ID', cfnOutputs.CacheVolume);
        this.state.setKey('REGION_ID', cfnOutputs.Region);
        this.state.setKey('PUBLIC_IP', cfnOutputs.ElasticIP);
        this.state.setKey('SECURITY_GROUP', cfnOutputs.SecurityGroup);
        this.state.setKey('SUBNET_ID', cfnOutputs.VpcPublicSubnet1);
        this.state.setKey('VPC_ID', cfnOutputs.VPC);
        this.state.setKey('IAM_ROLE_ARN', cfnOutputs.EC2RoleArn);
        this.state.setKey('EC2_INSTANCE_ID', cfnOutputs.EC2Instance);
        return true;
      }
      throw new Error(`Stack deleted`);
    } // else CFN is still pending
    return false;
  }

  async createStorageGateway() {
    await this.activateGateway();
    return this.wait(5)
      .maxAttempts(5)
      .until('validateGateway')
      .thenCall('addCacheToGateway');
  }

  async activateGateway() {
    const storageGateway = await this.getStorageGateway();
    const publicIp = await this.state.string('PUBLIC_IP');
    const region = await this.state.string('REGION_ID');
    const securityGroup = await this.state.string('SECURITY_GROUP');
    const requestContext = await this.payload.object('requestContext');
    const rawData = {
      publicIp,
      region,
      securityGroup,
      timezone: 'GMT', // TODO: Default it based on AWS region and take it optionally as a parameter from admin
    };
    const gatewayARN = await storageGateway.activateGateway(requestContext, rawData);
    this.print(`Found GatewayARN as ${gatewayARN} from storage-gateway`);
    this.state.setKey('GATEWAY_ARN', gatewayARN);
  }

  async validateGateway() {
    // Validate that the gateway creation went through. Without this validation we cannot perform any operations
    // on the Gateway like adding cache
    const storageGateway = await this.getStorageGateway();
    const requestContext = await this.payload.object('requestContext');
    try {
      const gatewayARN = await this.state.string('GATEWAY_ARN');
      await storageGateway.listLocalDisks(requestContext, gatewayARN);
    } catch (error) {
      this.print(`Gateway validation failed: ${error.stack}`);
      return false;
    }
    return true;
  }

  async addCacheToGateway() {
    // Add the volume created by this workflow step as a cache
    const gatewayARN = await this.state.string('GATEWAY_ARN');
    const volumeId = await this.state.string('VOLUME_ID');
    const rawData = {
      gatewayARN,
      volumeId,
    };
    const requestContext = await this.payload.object('requestContext');
    const storageGateway = await this.getStorageGateway();
    await storageGateway.addCacheToGateway(requestContext, rawData);

    // save result to DDB
    const vpcId = await this.state.string('VPC_ID');
    const subnetId = await this.state.string('SUBNET_ID');
    const ec2Instance = await this.state.string('EC2_INSTANCE_ID');
    const elasticIP = await this.state.string('PUBLIC_IP');
    const securityGroup = await this.state.string('SECURITY_GROUP');
    const ec2RoleARN = await this.state.string('IAM_ROLE_ARN');
    const cfnStackId = await this.state.string('STATE_STACK_ID');
    const dbData = {
      vpcId,
      subnetId,
      ec2Instance,
      elasticIP,
      securityGroup,
      ec2RoleARN,
      volumeIds: [volumeId],
      cfnStackId,
    };
    await storageGateway.saveToDDB(requestContext, dbData, gatewayARN);
  }

  async onFail() {
    // 1. Delete the stack if it was created
    // 2. Delete the Storage Gateway if it was created
    try {
      const stackId = await this.state.string('STATE_STACK_ID');
      const cfn = await this.getCloudFormationService();
      const stackInfo = (await cfn.describeStacks({ StackName: stackId }).promise()).Stacks[0];
      this.print(`Found stack status: ${stackInfo.StackStatus}`);
      if (stackInfo.StackStatus !== 'DELETE_COMPLETE') {
        this.print(`Deleting stack: ${stackId}`);
        await cfn.deleteStack({ StackName: stackId }).promise();
        this.print(`Deleted stack: ${stackId}`);
      }
    } finally {
      const storageGateway = await this.getStorageGateway();
      const requestContext = await this.payload.object('requestContext');
      const gatewayARN = await this.state.optionalString('GATEWAY_ARN');
      if (gatewayARN) {
        await storageGateway.deleteGateway(requestContext, gatewayARN);
      }
    }
  }

  async getUserService() {
    const [userService] = await this.mustFindServices(['userService']);
    return userService;
  }

  async getCloudFormationService() {
    const aws = await this.getAWS();
    return new aws.sdk.CloudFormation();
  }

  async getSSM() {
    const aws = await this.getAWS();
    return new aws.sdk.SSM({ apiVersion: '2014-11-06' });
  }

  async getStorageGateway() {
    const [storageGateway] = await this.mustFindServices(['storageGatewayService']);
    return storageGateway;
  }

  async getAWS() {
    const [aws] = await this.mustFindServices(['aws']);
    return aws;
  }

  getCfnOutputs(stackInfo) {
    const details = {};
    stackInfo.Outputs.forEach(option => {
      _.set(details, option.OutputKey, option.OutputValue);
    });
    return details;
  }
}

module.exports = CreateNetworkInfrastructure;
