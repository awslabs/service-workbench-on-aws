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
const url = require('url');
const yaml = require('js-yaml');

const StepBase = require('@aws-ee/base-workflow-core/lib/workflow/helpers/step-base');
const {
  getServiceCatalogClient,
} = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/helpers/env-type-service-catalog-helper');
const environmentStatusEnum = require('../../helpers/environment-status-enum');
const jsYamlCustomSchema = require('../../helpers/js-yaml-custom-schema');

const inPayloadKeys = {
  requestContext: 'requestContext',
  envTypeId: 'envTypeId',
  envTypeConfigId: 'envTypeConfigId',
  resolvedVars: 'resolvedVars',
  portfolioId: 'portfolioId',
  productId: 'productId',
};

const outPayloadKeys = {
  needsAlb: 'needsAlb',
};

const settingKeys = {
  envMgmtRoleArn: 'envMgmtRoleArn',
  isAppStreamEnabled: 'isAppStreamEnabled',
};

const pluginConstants = {
  extensionPoint: 'env-provisioning',
};

const MAX_COUNT_ALB_DEPENDENT_WORKSPACES = 100;

const failureStatuses = [
  'CREATE_FAILED',
  'ROLLBACK_FAILED',
  'DELETE_FAILED',
  'UPDATE_ROLLBACK_FAILED',
  'ROLLBACK_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
];
const successStatuses = ['CREATE_COMPLETE', 'DELETE_COMPLETE', 'UPDATE_COMPLETE'];

/**
 * Workflow step that checks for dependencies of a product before lauching the products and solves the dependency
 * Dependency check is performed based on the output of the product CFT
 */
class CheckLaunchDependency extends StepBase {
  inputKeys() {
    return {
      [inPayloadKeys.requestContext]: 'object',
      [inPayloadKeys.resolvedVars]: 'object',
      [inPayloadKeys.portfolioId]: 'string',
      [inPayloadKeys.productId]: 'string',
      [inPayloadKeys.envTypeId]: 'string',
      [inPayloadKeys.envTypeConfigId]: 'string',
    };
  }

  async start() {
    const [requestContext, resolvedVars, envTypeId, envTypeConfigId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.payloadOrConfig.string(inPayloadKeys.envTypeId),
      this.payloadOrConfig.string(inPayloadKeys.envTypeConfigId),
    ]);
    const [albService, lockService, envTypeConfigService] = await this.mustFindServices([
      'albService',
      'lockService',
      'envTypeConfigService',
    ]);
    const projectId = resolvedVars.projectId;
    const envTypeConfig = await envTypeConfigService.mustFind(requestContext, envTypeId, { id: envTypeConfigId });

    // Create dynamic namespace follows the existing pattern of namespace
    resolvedVars.namespace = `analysis-${Date.now()}`;
    const resolvedInputParams = await this.resolveVarExpressions(envTypeConfig.params, resolvedVars);
    const templateOutputs = await this.getTemplateOutputs(requestContext, envTypeId);

    const metaConnection1Type = _.get(templateOutputs.MetaConnection1Type, 'Value');
    if (!_.isUndefined(metaConnection1Type) && metaConnection1Type.toLowerCase() === 'rstudio')
      throw new Error('Deprecated version of RStudio detected. Please use RStudioV2.');

    const needsAlb = _.get(templateOutputs.NeedsALB, 'Value', false);
    if (!needsAlb) return null;

    // Locking the ALB provisioning to avoid race conditions on parallel provisioning.
    // expiresIn is set to 10 minutes. attemptsCount is set to 1200 to retry after 1 seconds for 20 minutes
    const awsAccountId = await albService.findAwsAccountId(requestContext, projectId);
    const lock = await lockService.tryWriteLock(
      { id: `alb-update-${awsAccountId}`, expiresIn: 1200 },
      { attemptsCount: 1200 },
    );
    this.print({
      msg: `obtained lock - ${lock}`,
    });
    if (_.isUndefined(lock)) throw new Error('Could not obtain a lock');
    this.state.setKey('ALB_LOCK', lock);

    const maxAlbWorkspacesCount = _.get(
      templateOutputs.MaxCountALBDependentWorkspaces,
      'Value',
      MAX_COUNT_ALB_DEPENDENT_WORKSPACES,
    );

    // Sets needsAlb to payload so it can be used to decrease alb workspace count on product failure
    await this.payload.setKey(outPayloadKeys.needsAlb, needsAlb);
    // eslint-disable-next-line no-return-await
    return await this.provisionAlb(requestContext, resolvedVars, projectId, resolvedInputParams, maxAlbWorkspacesCount);
  }

  /**
   * Method to provision ALB. The method checks if the max count of workspaces possible exist and
   * checks if there is an ALB aready exists for the AWS account and provisions if not exists.
   *
   * @param requestContext
   * @param resolvedVars
   * @param projectId
   * @param resolvedInputParams
   * @param maxAlbWorkspacesCount
   * @returns {Promise<>}
   */
  async provisionAlb(requestContext, resolvedVars, projectId, resolvedInputParams, maxAlbWorkspacesCount) {
    // Added additional check if lock exists before staring deployment
    const [albLock] = await Promise.all([this.state.optionalString('ALB_LOCK')]);
    if (!albLock) {
      throw new Error(`Error provisioning environment. Reason: ALB lock does not exist or expired`);
    }

    const [albService] = await this.mustFindServices(['albService']);
    const count = await albService.albDependentWorkspacesCount(requestContext, projectId);
    const albExists = await albService.checkAlbExists(requestContext, projectId);
    if (count >= maxAlbWorkspacesCount) {
      throw new Error(`Error provisioning environment. Reason: Maximum workspaces using ALB has reached`);
    }
    if (albExists) {
      this.print({
        msg: `ALB Already exists for the Account. Skipping ALB Creation`,
      });
    } else {
      this.print({
        msg: `Workspace needs ALB. Provisioning an ALB.`,
      });
      const stackInput = await albService.getStackCreationInput(
        requestContext,
        resolvedVars,
        resolvedInputParams,
        projectId,
      );
      // Create Stack
      // eslint-disable-next-line no-return-await
      return await this.deployStack(requestContext, resolvedVars, stackInput);
    }

    return null;
  }

  /**
   * Method to deploy ALB stack. The method gets cfn client and calls createStack API
   *
   * @param requestContext
   * @param resolvedVars
   * @param stackInput
   * @returns {Promise<>}
   */
  async deployStack(requestContext, resolvedVars, stackInput) {
    const cfn = await this.getCloudFormationService(requestContext, resolvedVars);
    const response = await cfn.createStack(stackInput).promise();
    // Update workflow state and poll for stack creation completion
    this.state.setKey('STACK_ID', response.StackId);
    return (
      this.wait(5) // check every 5 seconds
        // keep doing it for 1*1200 seconds = 20 minutes
        // IMPORTANT: if you change the maxAttempts below or the wait check period of 5 seconds above
        // then make sure to adjust the error message in "reportTimeout" accordingly
        .maxAttempts(1200)
        .until('shouldResumeWorkflow')
        .thenCall('onSuccessfulCompletion')
        .otherwiseCall('reportTimeout')
      // if anything fails, the "onFail" is called
    );
  }

  /**
   * Method to handle completion of ALB provisioning stack.
   * Method runs after the stack completion and stores the details in DB
   *
   * @param stackOutputs
   * @returns {Promise<>}
   */
  async handleStackCompletion(stackOutputs) {
    const [requestContext, resolvedVars, stackId, albLock] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.state.string('STACK_ID'),
      this.state.string('ALB_LOCK'),
    ]);
    const projectId = resolvedVars.projectId;
    // Update ALB details to DB
    const [albService] = await this.mustFindServices(['albService']);
    const awsAccountId = await albService.findAwsAccountId(requestContext, projectId);
    const albDetails = {
      id: awsAccountId,
      albStackName: stackId,
      albArn: _.get(stackOutputs, 'LoadBalancerArn', null),
      listenerArn: _.get(stackOutputs, 'ListenerArn', null),
      albDnsName: _.get(stackOutputs, 'ALBDNSName', null),
      albSecurityGroup: _.get(stackOutputs, 'ALBSecurityGroupId', null),
      albHostedZoneId: _.get(stackOutputs, 'ALBHostedZoneId', null),
      albDependentWorkspacesCount: 0,
    };
    if (!albLock) {
      throw new Error(`Error provisioning environment. Reason: ALB lock does not exist or expired`);
    }
    await albService.saveAlbDetails(awsAccountId, albDetails);

    this.print({
      msg: `Dependency Details Updated Successfully`,
    });
  }

  /**
   * Method to get CFT template output. The method gets CFT URL, read the CFT from S3
   * and parses the tmplate using js-yaml library
   *
   * @param requestContext
   * @param envTypeId
   * @returns {Promise<{Key: string:{Value: string, Description: string}}[]>}
   */
  async getTemplateOutputs(requestContext, envTypeId) {
    const { artifactInfo } = await this.describeArtifact(requestContext, envTypeId);
    const templateUrl = artifactInfo.TemplateUrl;
    const { bucketName, key } = await this.parseS3DetailsfromUrl(templateUrl);
    const templateBody = await this.getS3Object(bucketName, key);
    const templateBodyParsed = yaml.load(templateBody, { schema: jsYamlCustomSchema, json: true });
    const templateOutputs = _.get(templateBodyParsed, 'Outputs', {});
    return templateOutputs;
  }

  /**
   * Method to describe product artifact. The method gets service catalog client
   * and describes the product. returns the template URL
   *
   * @param requestContext
   * @param envTypeId
   * @returns {Promise<{artifactInfo: {}}[]>}
   */
  async describeArtifact(requestContext, envTypeId) {
    const [envTypeService, aws] = await this.mustFindServices(['envTypeService', 'aws']);
    const envType = await envTypeService.mustFind(requestContext, { id: envTypeId });
    const envMgmtRoleArn = this.settings.get(settingKeys.envMgmtRoleArn);
    const serviceCatalogClient = await getServiceCatalogClient(aws, envMgmtRoleArn);
    const params = {
      ProductId: envType.product.productId,
      ProvisioningArtifactId: envType.provisioningArtifact.id,
    };
    const { Info: artifactInfo } = await serviceCatalogClient.describeProvisioningArtifact(params).promise();
    return { artifactInfo };
  }

  /**
   * Method to read S3 object using S3 API
   *
   * @param bucketName
   * @param key
   * @returns {Promise<string>}
   */
  async getS3Object(bucketName, key) {
    try {
      const [aws] = await this.mustFindServices(['aws']);
      const s3Client = new aws.sdk.S3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };
      const data = await s3Client.getObject(params).promise();
      return data.Body.toString('utf-8');
    } catch (e) {
      throw new Error(
        `Error encountered while trying to read product template from S3: ${e}. Bucket: ${bucketName}, key: ${key}`,
      );
    }
  }

  /**
   * Method to parse the S3 url for bucket name and key. Took parsing logic from the AWS Java SDK
   * https://github.com/aws/aws-sdk-java/blob/master/aws-java-sdk-s3/src/main/java/com/amazonaws/services/s3/AmazonS3URI.java
   *
   * @param templateUrl
   * @returns {Promise<{bucketName:string, key:string}>}
   */
  async parseS3DetailsfromUrl(templateUrl) {
    const ENDPOINT_PATTERN = /^(.+\.)?s3[.-]([a-z0-9-]+)\./;
    const uri = url.parse(templateUrl);
    const matches = uri.host.match(ENDPOINT_PATTERN);
    if (!matches) {
      throw new Error(`Invalid S3 URL: ${templateUrl}`);
    }
    const prefix = matches[1];
    // remove last . from prefix
    const bucketName = prefix.substring(0, prefix.length - 1);
    const key = uri.pathname.substring(1);
    return { bucketName, key };
  }

  /**
   * Method to get the cloud formation service client for the target aws account
   *
   * @param requestContext
   * @param resolvedVars
   * @return {Promise<>}
   */
  async getCloudFormationService(requestContext, resolvedVars) {
    const [aws] = await this.mustFindServices(['aws']);
    const roleArn = await this.getTargetAccountRoleArn(requestContext, resolvedVars);
    const externalId = resolvedVars.externalId;
    this.print({
      msg: `Creating AWS Cloudformation Client by assuming role = ${roleArn}`,
      roleArn,
    });
    // get service catalog client sdk with the service catalog admin role credentials
    const cfnClient = await aws.getClientSdkForRole({
      roleArn,
      clientName: 'CloudFormation',
      options: { apiVersion: '2015-12-10' },
      externalId,
    });
    return cfnClient;
  }

  /**
   * Method to get appstream security group ID for the target aws account
   *
   * @param requestContext
   * @param resolvedVars
   * @returns {Promise<string>}
   */
  async getAppStreamSecurityGroupId(requestContext, resolvedVars) {
    const [albService] = await this.mustFindServices(['albService']);
    const { appStreamSecurityGroupId } = await albService.findAwsAccountDetails(requestContext, resolvedVars.projectId);
    return appStreamSecurityGroupId;
  }

  /**
   * Method to get role arn for the target aws account
   *
   * @param requestContext
   * @param resolvedVars
   * @returns {Promise<string>}
   */
  async getTargetAccountRoleArn(requestContext, resolvedVars) {
    const [albService] = await this.mustFindServices(['albService']);
    const { roleArn } = await albService.findAwsAccountDetails(requestContext, resolvedVars.projectId);
    return roleArn;
  }

  /**
   * Method to parse the output and key from the stack info
   *
   * @param stackInfo
   * @returns {Promise<{OutputKey: string:, OutputValue: string}[]>}
   */
  getStackOutputs(stackInfo) {
    const details = {};
    stackInfo.Outputs.forEach(option => {
      _.set(details, option.OutputKey, option.OutputValue);
    });
    return details;
  }

  /**
   * Method to parse the stack deployment error
   *
   * @param requestContext
   * @param resolvedVars
   * @param stackId
   * @returns {Promise<string>}
   */
  async getDeploymentError(requestContext, resolvedVars, stackId) {
    const cfn = await this.getCloudFormationService(requestContext, resolvedVars);
    const events = await cfn.describeStackEvents({ StackName: stackId }).promise();
    const failReasons = events.StackEvents.filter(e => failureStatuses.includes(e.ResourceStatus)).map(
      e => e.ResourceStatusReason || '',
    );
    return failReasons.join(' ');
  }

  /**
   * Method to resolve any variable expressions in the given key value pairs. The expressions may be in keys and/or values.
   *
   * @param keyValuePairs
   * @param resolvedVars
   * @returns {Promise<{Value: string, Key: string}[]>}
   */
  async resolveVarExpressions(keyValuePairs, resolvedVars) {
    const resolved = _.map(keyValuePairs, p => {
      const compiledKey = _.template(p.key);
      const resolvedKey = compiledKey(resolvedVars);

      const compiledValue = _.template(p.value);
      const resolvedValue = compiledValue(resolvedVars);
      return {
        Key: resolvedKey,
        Value: resolvedValue,
      };
    });
    return resolved;
  }

  /**
   * A method to decide when to resume the workflow.
   * This method checks for the status of the ALB being provisioned and returns true when the
   * stack has completed successfully. If the stack encountered any errors, the method throws an
   * error.
   *
   * @returns {Promise<boolean>}
   */
  async shouldResumeWorkflow() {
    const [requestContext, stackId, resolvedVars] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.state.string('STACK_ID'),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
    ]);
    const cfn = await this.getCloudFormationService(requestContext, resolvedVars);
    const stackInfo = (await cfn.describeStacks({ StackName: stackId }).promise()).Stacks[0];

    if (_.includes(failureStatuses, stackInfo.StackStatus)) {
      // If provisioning failed then throw error, any unhandled workflow errors
      // are handled in "onFail" method
      const error = await this.getDeploymentError(requestContext, resolvedVars, stackId);
      throw new Error(`ALB Stack operation failed with message: ${error}`);
    }

    if (_.includes(successStatuses, stackInfo.StackStatus)) {
      // If the provisioning completed successfully then return true to resume workflow}
      return true;
    }
    // Return false to continue waiting for the product provisioning to complete
    return false;
  }

  /**
   * Method to perform tasks after the alb provisioning is completed successfully.
   * @returns {Promise<*>}
   */
  async onSuccessfulCompletion() {
    const [requestContext, resolvedVars, stackId] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.state.string('STACK_ID'),
    ]);

    const cfn = await this.getCloudFormationService(requestContext, resolvedVars);
    const stackInfo = (await cfn.describeStacks({ StackName: stackId }).promise()).Stacks[0];
    const stackOutputs = this.getStackOutputs(stackInfo);
    // eslint-disable-next-line no-return-await
    return await this.handleStackCompletion(stackOutputs);
  }

  async reportTimeout() {
    const [stackName, resolvedVars, albLock] = await Promise.all([
      this.state.string('STACK_ID'),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.state.optionalString('ALB_LOCK'),
    ]);
    const envName = resolvedVars.name;
    // Release ALB lock if exists
    if (albLock) {
      const [lockService] = await this.mustFindServices(['lockService']);
      await lockService.releaseWriteLock({ writeToken: albLock });
      this.print({
        msg: `ALB lock released successfully`,
      });
    }
    throw new Error(
      `Error provisioning environment "${envName}".The workflow timed - out because the ALB provisioing stack "${stackName}" did not complete within the timeout period of 20 minutes.`,
    );
  }

  async onPass() {
    // this method is automatically invoked by the workflow engine when the step is completed
    const [albLock] = await Promise.all([this.state.optionalString('ALB_LOCK')]);
    const [lockService] = await this.mustFindServices(['lockService']);
    // Release ALB lock if exists
    if (albLock) {
      await lockService.releaseWriteLock({ writeToken: albLock });
      this.print({
        msg: `ALB lock released successfully`,
      });
    }
  }

  /**
   * Method to perform tasks upon some error. The method calls "onEnvProvisioningFailure" method on plugins registered for the extension point "env-provisioning"
   * @returns {Promise<*>}
   */
  async onFail(error) {
    this.printError(error);
    const [requestContext, resolvedVars, albLock] = await Promise.all([
      this.payloadOrConfig.object(inPayloadKeys.requestContext),
      this.payloadOrConfig.object(inPayloadKeys.resolvedVars),
      this.state.optionalString('ALB_LOCK'),
    ]);

    const [pluginRegistryService, lockService] = await this.mustFindServices(['pluginRegistryService', 'lockService']);
    // Release ALB lock if exists
    if (albLock) {
      await lockService.releaseWriteLock({ writeToken: albLock });
      this.print({
        msg: `ALB lock released successfully`,
      });
    }
    // Give all plugins a chance to react (such as updating database etc) to environment creation having failed
    await pluginRegistryService.visitPlugins(pluginConstants.extensionPoint, 'onEnvProvisioningFailure', {
      payload: {
        requestContext,
        container: this.container,
        resolvedVars,
        status: environmentStatusEnum.FAILED,
        error,
      },
    });
  }
}

module.exports = CheckLaunchDependency;
