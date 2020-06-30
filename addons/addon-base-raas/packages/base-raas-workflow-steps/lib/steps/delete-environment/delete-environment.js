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

const { fuzz } = require('@aws-ee/base-services/lib/helpers/utils');

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

class DeleteEnvironment extends StepBase {
  async start() {
    // Get services
    const [environmentService, environmentMountService] = await this.mustFindServices([
      'environmentService',
      'environmentMountService',
    ]);

    const cfn = await this.getCloudFormationService();

    // Get common payload params and pull environment info
    const [environmentId, requestContext] = await Promise.all([
      this.payload.string('environmentId'),
      this.payload.object('requestContext'),
    ]);
    const environment = await environmentService.mustFind(requestContext, { id: environmentId });

    // Set initial state
    this.state.setKey('STATE_ENVIRONMENT_ID', environmentId);
    this.state.setKey('STATE_REQUEST_CONTEXT', requestContext);
    this.state.setKey('STATE_STACK_ID', environment.stackId);

    // Confirm that the environment has an associated CFN stack ID
    this.print(`Deleting stack ${environment.stackId} for environment ${environment.id}`);
    if (!environment.stackId) {
      // if there is no stack id, then there's nothing else to clean up.
      return this.updateEnvironmentStatusToTerminated();
    }

    // Perform updates/termination
    // Remove from policies before deleting resources to prevent trying to save the principal ID
    // because the role was removed before the policy update. See
    // https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html
    // under IAM Roles
    await environmentMountService.removeRoleArnFromLocalResourcePolicies(
      environment.instanceInfo.WorkspaceInstanceRoleArn,
      environment.instanceInfo.s3Prefixes,
    );
    await Promise.all([
      this.deleteKeypair(),
      this.updateEnvironmentStatus('TERMINATING'),
      cfn.deleteStack({ StackName: environment.stackId }).promise(),
    ]);

    // Poll until the stack has been deleted
    return this.wait(fuzz(80))
      .maxAttempts(120)
      .until('checkCfnCompleted')
      .thenCall('updateEnvironmentStatusToTerminated');
  }

  /**
   * CloudFormation and Workflow-Related Methods
   */
  async checkCfnCompleted() {
    const stackId = await this.state.string('STATE_STACK_ID');
    this.print(`stack id is ${stackId}`);
    const cfn = await this.getCloudFormationService();
    const stackInfo = (await cfn.describeStacks({ StackName: stackId }).promise()).Stacks[0];

    if (STACK_FAILED.includes(stackInfo.StackStatus)) {
      throw new Error(`Stack operation failed with message: ${stackInfo.StackStatusReason}`);
    } else {
      return !!STACK_SUCCESS.includes(stackInfo.StackStatus);
    }
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

  async updateEnvironmentStatusToTerminated() {
    return this.updateEnvironmentStatus('TERMINATED');
  }

  async updateEnvironmentStatus(status) {
    const environmentService = await this.mustFindServices('environmentService');
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');
    await environmentService.update(requestContext, { id, status });
  }

  async onFail() {
    return this.updateEnvironmentStatus('TERMINATING_FAILED');
  }

  /**
   * External Resource-Related Methods
   */
  async deleteKeypair() {
    const environmentKeypairService = await this.mustFindServices('environmentKeypairService');
    const id = await this.state.string('STATE_ENVIRONMENT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');
    try {
      await environmentKeypairService.delete(requestContext, id);
    } catch (error) {
      // Ignore ParameterNotFound errors from Parameter Store if the key was already
      // deleted or no key was ever created (e.g., for SageMaker environments)
      if (!('code' in error) || error.code !== 'ParameterNotFound') {
        throw error;
      }
    }
  }
}

module.exports = DeleteEnvironment;
