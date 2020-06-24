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

class ProvisionEnvironment extends StepBase {
  async start() {
    // start workflow that starts the CFN Template, updates status to PROCESSING, waits for CFN to finish, updates env status to COMPLETED/FAILED

    // Get services
    const [
      environmentService,
      cfnTemplateService,
      environmentKeypairService,
      environmentMountService,
    ] = await this.mustFindServices([
      'environmentService',
      'cfnTemplateService',
      'environmentKeypairService',
      'environmentMountService',
    ]);

    // Get common payload params and pull environment info
    const [type, environmentId, requestContext, vpcId, vpcSubnet, encryptionKeyArn] = await Promise.all([
      this.payload.string('type'),
      this.payload.string('environmentId'),
      this.payload.object('requestContext'),
      this.payload.string('vpcId'),
      this.payload.string('subnetId'),
      this.payload.string('encryptionKeyArn'),
    ]);
    const environment = await environmentService.mustFind(requestContext, { id: environmentId });
    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    // Stacknaming combining datetime & randomString to avoid collisions when to workspaces are created at the same time
    const stackName =
      `analysis` +
      `-${new Date().getTime()}` +
      `-${[...Array(12)].map(() => Math.round(Math.random() * 36).toString(36)).join('')}`;

    // Set initial state
    this.state.setKey('STATE_ENVIRONMENT_ID', environmentId);
    this.state.setKey('STATE_REQUEST_CONTEXT', requestContext);

    // Define array for collecting CloudFormation functions
    const cfnParams = [];
    const addParam = (key, value) => cfnParams.push({ ParameterKey: key, ParameterValue: value });

    // Add parameters unique to each environment type
    let template;
    switch (type) {
      case 'ec2-linux':
        template = await cfnTemplateService.getTemplate('ec2-linux-instance');
        break;
      case 'ec2-windows':
        template = await cfnTemplateService.getTemplate('ec2-windows-instance');
        break;
      case 'sagemaker':
        template = await cfnTemplateService.getTemplate('sagemaker-notebook-instance');
        break;
      case 'emr': {
        template = await cfnTemplateService.getTemplate('emr-cluster');

        addParam('DiskSizeGB', environment.instanceInfo.config.diskSizeGb.toString());
        addParam('MasterInstanceType', environment.instanceInfo.size);
        addParam('WorkerInstanceType', environment.instanceInfo.config.workerInstanceSize);
        addParam('CoreNodeCount', environment.instanceInfo.config.workerInstanceCount.toString());

        // Add parameters to support spot instance pricing if specified
        // TODO this needs to be parameterized
        const isOnDemand = !environment.instanceInfo.config.spotBidPrice;
        // The spot bid price can only have 3 decimal places maximum
        const spotBidPrice = isOnDemand ? '0' : environment.instanceInfo.config.spotBidPrice.toFixed(3);

        addParam('Market', isOnDemand ? 'ON_DEMAND' : 'SPOT');
        addParam('WorkerBidPrice', spotBidPrice);

        this.print(
          isOnDemand
            ? 'Launching on demand core nodes'
            : `Launching spot core nodes with a bid price of ${spotBidPrice}`,
        );

        break;
      }
      default:
        throw new Error(`Unknown environment type requested: ${type}`);
    }

    // Handle CFN parameters that need to be excluded from certain environment types
    if (type !== 'ec2-windows') {
      const {
        s3Mounts,
        iamPolicyDocument,
        environmentInstanceFiles,
        s3Prefixes,
      } = await environmentMountService.getCfnMountParameters(requestContext, environment);

      addParam('S3Mounts', s3Mounts);
      addParam('IamPolicyDocument', iamPolicyDocument);
      addParam('EnvironmentInstanceFiles', environmentInstanceFiles);

      // Only save the prefixes for the local resources, otherwise we add list and get access for
      // potentially the whole study bucket
      this.state.setKey('ENV_S3_STUDY_PREFIXES', s3Prefixes);
    }

    if (type !== 'sagemaker') {
      const credential = await this.getCredentials();
      const [amiImage, cidr, keyName] = await Promise.all([
        this.payload.string('amiImage'),
        this.payload.string('cidr'),
        environmentKeypairService.create(requestContext, environmentId, credential),
      ]);

      addParam('AmiId', amiImage);
      addParam('AccessFromCIDRBlock', cidr);
      addParam('KeyName', keyName);
    }

    if (type !== 'emr') {
      addParam('InstanceType', environment.instanceInfo.size);
    }

    // Add rest of parameters
    addParam('Namespace', stackName);
    addParam('VPC', vpcId);
    addParam('Subnet', vpcSubnet);
    addParam('EncryptionKeyArn', encryptionKeyArn);

    const input = {
      StackName: stackName,
      Parameters: cfnParams,
      Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      TemplateBody: template,
      Tags: [
        {
          Key: 'Description',
          Value: `Created by ${by.username}`,
        },
        {
          Key: 'Env',
          Value: environmentId,
        },
        {
          Key: 'Proj',
          Value: environment.indexId,
        },
        {
          Key: 'CreatedBy',
          Value: by.username,
        },
      ],
    };

    // Create stack
    const cfn = await this.getCloudFormationService();
    const response = await cfn.createStack(input).promise();

    // Update workflow state and poll for stack creation completion
    this.state.setKey('STATE_STACK_ID', response.StackId);
    await this.updateEnvironment({ stackId: response.StackId });
    return this.wait(60, true)
      .maxAttempts(120)
      .until('checkCfnCompleted');
  }

  async getCloudFormationService() {
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

    return new aws.sdk.CloudFormation({ accessKeyId, secretAccessKey, sessionToken });
  }

  async getCredentials() {
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
        RoleSessionName: `RaaS-${requestContext.principalIdentifier.username}-OrgRole`,
        ExternalId,
      })
      .promise();

    return { accessKeyId, secretAccessKey, sessionToken };
  }

  /**
   * CloudFormation and Workflow-Related Methods
   */
  async checkCfnCompleted() {
    const environmentMountService = await this.mustFindServices('environmentMountService');
    const stackId = await this.state.string('STATE_STACK_ID');
    this.print(`checking status of cfn stack: ${stackId}`);

    // const cfnTemplateService = await this.mustFindServices('')
    const cfn = await this.getCloudFormationService();
    const stackInfo = (await cfn.describeStacks({ StackName: stackId }).promise()).Stacks[0];

    if (STACK_FAILED.includes(stackInfo.StackStatus)) {
      throw new Error(`Stack operation failed with message: ${stackInfo.StackStatusReason}`);
    } else if (STACK_SUCCESS.includes(stackInfo.StackStatus)) {
      // handle the case where the cloudformation is deleted before the creation could finish
      if (stackInfo.StackStatus !== 'DELETE_COMPLETE') {
        const cfnOutputs = this.getCfnOutputs(stackInfo);

        // Update S3 and KMS resources if needed
        const s3Prefixes = await this.state.optionalArray('ENV_S3_STUDY_PREFIXES');
        if (s3Prefixes.length > 0) {
          await environmentMountService.addRoleArnToLocalResourcePolicies(
            cfnOutputs.WorkspaceInstanceRoleArn,
            s3Prefixes,
          );
        }

        // Update environment metadata
        await this.updateEnvironment({
          status: 'COMPLETED',
          instanceInfo: {
            ...cfnOutputs,
            s3Prefixes,
          },
        });
      }
      return true;
    } // else CFN is still pending
    return false;
  }

  getCfnOutputs(stackInfo) {
    const details = {};
    stackInfo.Outputs.forEach(option => {
      _.set(details, option.OutputKey, option.OutputValue);
    });
    return details;
  }

  async updateEnvironment(environment) {
    const environmentService = await this.mustFindServices('environmentService');
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');
    environment.id = id;
    await environmentService.update(requestContext, environment);
  }

  async onFail() {
    const error = await this.getDeploymentError();
    await this.updateEnvironment({ status: 'FAILED', error });
  }

  async getDeploymentError() {
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');

    const environmentService = await this.mustFindServices('environmentService');
    const existingEnvironment = await environmentService.mustFind(requestContext, { id });

    const { stackId } = existingEnvironment;
    const cfn = await this.getCloudFormationService();

    const events = await cfn.describeStackEvents({ StackName: stackId }).promise();
    const failReasons = events.StackEvents.filter(e => STACK_FAILED.includes(e.ResourceStatus)).map(
      e => e.ResourceStatusReason || '',
    );

    return failReasons.join(' ');
  }
}

module.exports = ProvisionEnvironment;
