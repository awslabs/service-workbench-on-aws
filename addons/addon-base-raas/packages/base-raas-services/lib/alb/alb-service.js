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
const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  domainName: 'domainName',
};

class ALBService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'auditWriterService',
      'indexesService',
      'projectService',
      'deploymentStoreService',
      'awsAccountsService',
      'cfnTemplateService',
      'environmentScService',
    ]);
  }

  async init() {
    await super.init();
  }

  /**
   * Method to get the count of workspaces that are dependent on ALB
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<int>}
   */
  async albDependentWorkspacesCount(requestContext, projectId) {
    const deploymentItem = await this.getAlbDetails(requestContext, projectId);
    if (deploymentItem) {
      const albRecord = JSON.parse(deploymentItem.value);
      return albRecord.albDependentWorkspacesCount;
    }
    return 0;
  }

  /**
   * Method to check if ALB exists in the AWS account. Returns false if there is no record or
   * if albArn is null
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<boolean>}
   */
  async checkAlbExists(requestContext, projectId) {
    const deploymentItem = await this.getAlbDetails(requestContext, projectId);
    if (deploymentItem) {
      const albRecord = JSON.parse(deploymentItem.value);
      return !!_.get(albRecord, 'albArn', null);
    }
    return false;
  }

  /**
   * Method to get the input parameters for ALB stack creation.
   * The method reads cfn template using the cfnTemplateService
   *
   * @param requestContext
   * @param resolvedVars
   * @param resolvedInputParams
   * @param projectId
   * @returns {Promise<{}>}
   */
  async getStackCreationInput(requestContext, resolvedVars, resolvedInputParams, projectId) {
    const awsAccountDetails = await this.findAwsAccountDetails(requestContext, projectId);
    const [cfnTemplateService] = await this.service(['cfnTemplateService']);
    const [template] = await Promise.all([cfnTemplateService.getTemplate('application-load-balancer')]);
    const cfnParams = [];
    const certificateArn = _.find(resolvedInputParams, o => o.Key === 'ACMSSLCertARN');

    const addParam = (key, v) => cfnParams.push({ ParameterKey: key, ParameterValue: v });
    addParam('Namespace', resolvedVars.namespace);
    addParam('Subnet1', awsAccountDetails.subnetId);
    addParam('ACMSSLCertARN', certificateArn.Value);
    addParam('VPC', awsAccountDetails.vpcId);

    const input = {
      StackName: resolvedVars.namespace,
      Parameters: cfnParams,
      TemplateBody: template,
      Tags: [
        {
          Key: 'Description',
          Value: 'Created by SWB for the AWS account',
        },
      ],
    };
    return input;
  }

  /**
   * Method to save the ALB details in database. Stringifies the details before storing in the table
   *
   * @param awsAccountId
   * @param details
   * @returns {Promise<>}
   */
  async saveAlbDetails(awsAccountId, details) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    const result = await deploymentStore.createOrUpdate({
      type: 'account-workspace-details',
      id: awsAccountId,
      value: JSON.stringify(details),
    });
    return result;
  }

  /**
   * Method to get the ALB details.
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<>}
   */
  async getAlbDetails(requestContext, projectId) {
    const awsAccountId = await this.findAwsAccountId(requestContext, projectId);
    const deploymentItem = await this.findDeploymentItem({ id: awsAccountId });
    return deploymentItem;
  }

  /**
   * Method to find the AWS account details for a project.
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<>}
   */
  async findAwsAccountDetails(requestContext, projectId) {
    const awsAccountId = await this.findAwsAccountId(requestContext, projectId);
    const [awsAccountsService] = await this.service(['awsAccountsService']);
    const awsAccountDetails = await awsAccountsService.mustFind(requestContext, { id: awsAccountId });
    return awsAccountDetails;
  }

  /**
   * Method to find the AWS account ID for a project.
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<string>}
   */
  async findAwsAccountId(requestContext, projectId) {
    const [indexesService, projectService] = await this.service(['indexesService', 'projectService']);
    const project = await projectService.mustFind(requestContext, { id: projectId });
    const { indexId } = project;
    // Get the aws account information
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });
    return awsAccountId;
  }

  /**
   * Method to find deployment item from the deployment store table.
   *
   * @param id
   * @returns {Promise<>}
   */
  async findDeploymentItem({ id }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    const deploymentItem = await deploymentStore.mustFind({ type: 'account-workspace-details', id });
    return deploymentItem;
  }

  /**
   * Method to create listener rule. The method creates rule using the ALB SDK client.
   * Tags are read form the resolvedVars so the billing will happen properly
   *
   * @param prefix
   * @param requestContext
   * @param resolvedVars
   * @param targetGroupArn
   * @returns {Promise<string>}
   */
  async createListenerRule(prefix, requestContext, resolvedVars, targetGroupArn) {
    const deploymentItem = await this.getAlbDetails(requestContext, resolvedVars.projectId);
    const albRecord = JSON.parse(deploymentItem.value);
    const listenerArn = albRecord.listenerArn;
    const priority = albRecord.albDependentWorkspacesCount + 1;
    const subdomain = this.getHostname(prefix, resolvedVars.envId);
    const params = {
      ListenerArn: listenerArn,
      Priority: priority,
      Actions: [
        {
          TargetGroupArn: targetGroupArn,
          Type: 'forward',
        },
      ],
      Conditions: [
        {
          Field: 'host-header',
          HostHeaderConfig: {
            Values: [subdomain],
          },
        },
        {
          Field: 'source-ip',
          SourceIpConfig: {
            Values: [resolvedVars.cidr],
          },
        },
      ],
      Tags: resolvedVars.tags,
    };
    const albClient = await this.getAlbSdk(requestContext, resolvedVars);
    let response = null;
    try {
      response = await albClient.createRule(params).promise();
    } catch (err) {
      throw new Error(`Error creating rule. Rule creation failed with message - ${err.message}`);
    }
    return response.Rules[0].RuleArn;
  }

  /**
   * Method to delete listener rule. The method deletes rule using the ALB SDK client.
   *
   * @param requestContext
   * @param resolvedVars
   * @param ruleArn
   * @returns {Promise<>}
   */
  async deleteListenerRule(requestContext, resolvedVars, ruleArn) {
    const params = {
      RuleArn: ruleArn,
    };
    const albClient = await this.getAlbSdk(requestContext, resolvedVars);
    let response = null;
    try {
      response = await albClient.deleteRule(params).promise();
    } catch (err) {
      throw new Error(`Error deleting rule. Rule deletion failed with message - ${err.message}`);
    }
    return response;
  }

  /**
   * Method to increase the count of alb dependent workspaces in database
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<>}
   */
  async increaseAlbDependentWorkspaceCount(requestContext, projectId) {
    const deploymentItem = await this.getAlbDetails(requestContext, projectId);
    const albRecord = JSON.parse(deploymentItem.value);
    albRecord.albDependentWorkspacesCount += 1;
    const result = await this.saveAlbDetails(deploymentItem.id, albRecord);
    await this.audit(requestContext, { action: 'update-deployment-store', body: result });
    return result;
  }

  /**
   * Method to decrease the count of alb dependent workspaces in database
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<>}
   */
  async decreaseAlbDependentWorkspaceCount(requestContext, projectId) {
    const deploymentItem = await this.getAlbDetails(requestContext, projectId);
    const albRecord = JSON.parse(deploymentItem.value);
    albRecord.albDependentWorkspacesCount -= 1;
    const result = await this.saveAlbDetails(deploymentItem.id, albRecord);
    await this.audit(requestContext, { action: 'update-deployment-store', body: result });
    return result;
  }

  /**
   * Method to get the hostname for the environment
   *
   * @param prefix
   * @param id
   * @returns {Promise<string>}
   */
  getHostname(prefix, id) {
    const domainName = this.settings.get(settingKeys.domainName);
    return `${prefix}-${id}.${domainName}`;
  }

  /**
   * Method to get the ALB SDK client for the target aws account
   *
   * @param requestContext
   * @param resolvedVars
   * @returns {Promise<>}
   */
  async getAlbSdk(requestContext, resolvedVars) {
    const [aws] = await this.service(['aws']);
    const roleArn = await this.getTargetAccountRoleArn(requestContext, resolvedVars.projectId);
    const externalId = resolvedVars.externalId;
    const albClient = await aws.getClientSdkForRole({
      roleArn,
      clientName: 'ELBv2',
      options: { apiVersion: '2015-12-10' },
      externalId,
    });
    return albClient;
  }

  /**
   * Method to get role arn for the target aws account
   *
   * @param requestContext
   * @param projectId
   * @returns {Promise<string>}
   */
  async getTargetAccountRoleArn(requestContext, projectId) {
    const { roleArn } = await this.findAwsAccountDetails(requestContext, projectId);
    return roleArn;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  /**
   * Method to modify rule. The method modify the rule using the ALB SDK client.
   * Tags are read form the resolvedVars so the billing will happen properly
   *
   * @param requestContext
   * @param resolvedVars
   * @returns {Promise<D & {$response: Response<D, E>}>}
   */
  async modifyRule(requestContext, resolvedVars) {
    try {
      const [cidr] = resolvedVars.cidr;
      const params = {
        Conditions: [
          {
            Field: 'source-ip',
            SourceIpConfig: {
              Values: [cidr],
            },
          },
        ],
        RuleArn: resolvedVars.ruleARN,
      };

      const { externalId } = await this.findAwsAccountDetails(requestContext, resolvedVars.projectId);
      resolvedVars.externalId = externalId;
      const albClient = await this.getAlbSdk(requestContext, resolvedVars);
      const response = await albClient.modifyRule(params).promise();
      return response;
    } catch (e) {
      if (!e.message) throw this.boom.unauthorized(`${e.message}`, true);
      return e.message;
    }
  }
}

module.exports = ALBService;
