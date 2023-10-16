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
// const _ = require('lodash');
const Service = require('@amzn/base-services-container/lib/service');

class VpcePolicyService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'studyService', 'projectService', 'awsCfnService', 'awsAccountsService']);
  }

  async init() {
    await super.init();
    // setup service and SDK clients
    [
      this.aws,
      this.studyService,
      this.projectService,
      this.awsCfnService,
      this.awsAccountsService,
    ] = await this.service(['aws', 'studyService', 'projectService', 'awsCfnService', 'awsAccountsService']);
  }

  /**
   * Gets the EC2 SDK Client for the Account attached to the project the study is in. This method uses the cross account permissions role.
   *
   * @param requestContext
   * @param  studyEntity that contains the Id of the Study
   * @returns EC2 SDK Client
   */
  async getEc2ServiceForStudy(requestContext, studyEntity) {
    const studyId = studyEntity.id;
    const { projectId } = await this.studyService.mustFind(requestContext, studyId);
    const accEntity = await this.projectService.getAccountForProjectId(requestContext, projectId);
    const { roleArn: RoleArn, externalId: ExternalId } = await this.awsAccountsService.mustFind(requestContext, {
      id: accEntity.id,
    });

    const sts = new this.aws.sdk.STS();
    if (!requestContext.principal.username) {
      throw new Error('Username is required');
    }
    const {
      Credentials: { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken },
    } = await sts
      .assumeRole({
        RoleArn,
        RoleSessionName: `RaaS-${requestContext.principal.username}`,
        ExternalId,
      })
      .promise();

    return new this.aws.sdk.EC2({ accessKeyId, secretAccessKey, sessionToken });
  }

  /**
   * This method adds the given AWS account id to the exiting VPCE policy with nonmutating KMS actions.
   * If the sidToReplace exists, it adds the account to the Resource list of the existing statment.
   * If it is not found, it creates a new Statement with sidToReplace. If the account has
   * already been added to the policy, it does nothing.
   *
   * @param ec2Client - the EC2 SDK client with permissions to call EC2 DescribeVpcEndpoints and ModifyVpcEndpoint
   * @param awsAccountId - the ID of the AWS Account to add to the policy. This is likely the account hosting the BYOB study.
   * @param vpceId - the ID of the VPCE to update the policy of
   * @param region - the region in which the keys within the AWS account are. This is likely to region the solution is deployed in.
   * @param sidToReplace - the Sid of the Statement to replace (likely 'BYOB Account Keys')
   * @returns
   */
  async addAccountToKmsVpcePolicy(ec2Client, awsAccountId, vpceId, region, sidToReplace) {
    // Get VPCE Policy
    const vpcePolicy = await this.getVpcePolicy(ec2Client, vpceId);
    // check if Statement for Sid exists
    const sidStatement = vpcePolicy.Statement.find(statement => statement.Sid === sidToReplace);
    if (!sidStatement) {
      // create Statement
      const statement = {
        Sid: sidToReplace,
        Effect: 'Allow',
        Principal: '*',
        Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
        Resource: [`arn:aws:kms:${region}:${awsAccountId}:key/*`],
      };
      // add Statement to VPCE Policy
      vpcePolicy.Statement.push(statement);
      // save new policy to VPCE
      await ec2Client
        .modifyVpcEndpoint({
          VpcEndpointId: vpceId,
          PolicyDocument: JSON.stringify(vpcePolicy),
        })
        .promise();
      return;
    }
    // get resource list
    const resourceList = sidStatement.Resource;
    // check if resource list already contains account
    const accountResource = resourceList.find(resource => resource === `arn:aws:kms:${region}:${awsAccountId}:key/*`);
    if (!accountResource) {
      // add account to Resource list
      resourceList.push(`arn:aws:kms:${region}:${awsAccountId}:key/*`);
      sidStatement.Resource = resourceList;
      // replace Statement in VPCE Policy
      vpcePolicy.Statement = vpcePolicy.Statement.map(statement =>
        statement.Sid === sidToReplace ? sidStatement : statement,
      );
      // save updated policy to VPCE
      await ec2Client
        .modifyVpcEndpoint({
          VpcEndpointId: vpceId,
          PolicyDocument: JSON.stringify(vpcePolicy),
        })
        .promise();
    }
  }

  /**
   * * This method adds the given Role ARN to the exiting VPCE policy allowing the AssumeRole action.
   * If the sidToReplace exists, it adds the Role Arn to the Resource list of the existing statment.
   * If it is not found, it creates a new Statement with sidToReplace. If the Role ARN has
   * already been added to the policy, it does nothing.
   *
   * @param ec2Client - the EC2 SDK client with permissions to call EC2 DescribeVpcEndpoints and ModifyVpcEndpoint
   * @param roleArn - the ARN of the role to add to the policy
   * @param vpceId - the ID of the VPCE to update the policy of
   * @param sidToReplace - the Sid of the Statement to replace (likely 'AllowAssumeRole')
   */
  async addRoleToStsVpcePolicy(ec2Client, roleArn, vpceId, sidToReplace) {
    // Get VPCE Policy
    const vpcePolicy = await this.getVpcePolicy(ec2Client, vpceId);
    // Check if Statement for Sid exists
    const sidStatement = vpcePolicy.Statement.find(statement => statement.Sid === sidToReplace);
    if (!sidStatement) {
      // create Statement
      const statement = {
        Sid: sidToReplace,
        Effect: 'Allow',
        Principal: '*',
        Action: ['sts:AssumeRole'],
        Resource: [roleArn],
      };
      // add Statement to VPCE Policy
      vpcePolicy.Statement.push(statement);
      // save new policy to VPCE
      await ec2Client
        .modifyVpcEndpoint({
          VpcEndpointId: vpceId,
          PolicyDocument: JSON.stringify(vpcePolicy),
        })
        .promise();
      return;
    }
    // get resource list
    const resourceList = sidStatement.Resource;
    // check if resource list already contains role
    const accountResource = resourceList.find(resource => resource === roleArn);
    if (!accountResource) {
      // add role to Resource list
      resourceList.push(roleArn);
      sidStatement.Resource = resourceList;
      // replace Statement in VPCE Policy
      vpcePolicy.Statement = vpcePolicy.Statement.map(statement =>
        statement.Sid === sidToReplace ? sidStatement : statement,
      );
      // save updated policy to VPCE
      await ec2Client
        .modifyVpcEndpoint({
          VpcEndpointId: vpceId,
          PolicyDocument: JSON.stringify(vpcePolicy),
        })
        .promise();
    }
  }

  /**
   * Gets the existing VPCE policy attached to the VPC Endpoint
   * @param ec2Client - the EC2 SDK client with permissions to call EC2 DescribeVpcEndpoints
   * @param vpceId - the ID of the VPCE to get the policy of
   * @returns JSON object of the VPCE policy
   */
  async getVpcePolicy(ec2Client, vpceId) {
    const vpces = await ec2Client.describeVpcEndpoints().promise();
    const vpce = vpces.VpcEndpoints.find(vpcEndpoint => vpcEndpoint.VpcEndpointId === vpceId);
    const vpcePolicy = vpce ? vpce.PolicyDocument : JSON.stringify({ Version: '2012-10-17', Statement: [] });
    return JSON.parse(vpcePolicy);
  }

  /**
   * Gets the VPCE ID in the AWS Account from the project attached to the study
   * @param requestContext
   * @param studyEntity
   * @returns the ID of the VPCE attached to the study
   */
  async getVpceIdFromStudy(requestContext, studyEntity, vpceServiceName) {
    const studyId = studyEntity.id;
    const { projectId } = await this.studyService.mustFind(requestContext, studyId);
    const accEntity = await this.projectService.getAccountForProjectId(requestContext, projectId);
    if (vpceServiceName === 'KMS') {
      return this.awsCfnService.getKmsVpcEndpointId(accEntity);
    }
    if (vpceServiceName === 'STS') {
      return this.awsCfnService.getStsVpcEndpointId(accEntity);
    }
    throw new Error('VPCE Service Name not supported');
  }
}

module.exports = VpcePolicyService;
