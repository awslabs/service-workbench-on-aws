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
            'environmentScService'
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
        } else {
            return 0;
        }
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
            return _.get(albRecord, "albArn", null) ? true : false;
        } else {
            return false;
        }
    }

    /**
    * Method to get the input parameters for ALB stack creation.
    * The method reads cfn template using the cfnTemplateService
    *
    * @param requestContext
    * @param resolvedInputParams
    * @param projectId
    * @returns {Promise<{}>}
    */
    async getStackCreationInput(requestContext, resolvedInputParams, projectId) {
        const awsAccountDetails = await this.findAwsAccountDetails(requestContext, projectId);
        const [cfnTemplateService] = await this.service(['cfnTemplateService']);
        const [template] = await Promise.all([cfnTemplateService.getTemplate('application-load-balancer')]);
        const stackName = `alb-stack-${new Date().getTime()}`;
        const cfnParams = [];
        const certificateArn = _.find(resolvedInputParams, o => o.Key === 'ACMSSLCertARN');

        const addParam = (key, v) => cfnParams.push({ ParameterKey: key, ParameterValue: v });
        addParam('Namespace', stackName);
        addParam('Subnet1', awsAccountDetails.subnetId);
        addParam('ACMSSLCertARN', certificateArn.Value);
        addParam('VPC', awsAccountDetails.vpcId);

        const input = {
            StackName: stackName,
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
        return deploymentStore.createOrUpdate({ type: 'account-workspace-details', id: awsAccountId, value: JSON.stringify(details) });
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
        return await this.findDeploymentItem({ id: awsAccountId });
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
        return await awsAccountsService.mustFind(requestContext, { id: awsAccountId });
    }

    /**
    * Method to find the AWS account ID for a project.
    *
    * @param requestContext
    * @param projectId
    * @returns {Promise<string>}
    */
    async findAwsAccountId(requestContext, projectId) {
        const [
            indexesService,
            ProjectService,
        ] = await this.service([
            'indexesService',
            'projectService',
        ]);
        const project = await ProjectService.mustFind(requestContext, { id: projectId });
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
        return await deploymentStore.find({ type: 'account-workspace-details', id });
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
                    Type: "forward"
                }
            ],
            Conditions: [
                {
                    Field: "host-header",
                    HostHeaderConfig: {
                        Values: [subdomain]
                    }
                },
                {
                    Field: "source-ip",
                    SourceIpConfig: {
                        Values: [resolvedVars.cidr]
                    }
                },
            ],
            Tags: resolvedVars.tags
        }
        const albClient = await this.getAlbSdk(requestContext, resolvedVars);
        const response = await albClient.createRule(params).promise();
        return response.Rules[0].RuleArn;
    }

    /**
    * Method to increase the count of alb dependent workspaces in database
    *
    * @param requestContext
    * @param resolvedVars
    * @returns {Promise<>}
    */
    async increaseAlbDependentWorkspaceCount(requestContext, resolvedVars) {
        const deploymentItem = await this.getAlbDetails(requestContext, resolvedVars.projectId);
        var albRecord = JSON.parse(deploymentItem.value);
        albRecord.albDependentWorkspacesCount = albRecord.albDependentWorkspacesCount + 1;
        await this.saveAlbDetails(deploymentItem.id, albRecord);
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
}

module.exports = ALBService;
