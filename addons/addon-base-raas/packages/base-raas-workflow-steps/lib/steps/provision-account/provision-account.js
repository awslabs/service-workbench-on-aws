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

const settingKeys = {
  artifactsBucketName: 'artifactsBucketName',
  launchConstraintRolePrefix: 'launchConstraintRolePrefix',
  launchConstraintPolicyPrefix: 'launchConstraintPolicyPrefix',
};

class ProvisionAccount extends StepBase {
  // ======================================================
  // PLEASE NOTE: the following account provision is assuming the account organization is already been setup
  // TODOs: create organization in master account, the role access limitation needs to be changed as well
  // ======================================================
  async start() {
    this.print('start provisioning accounts');
    const [requestContext] = await Promise.all([this.payload.object('requestContext')]);
    this.state.setKey('STATE_REQUEST_CONTEXT', requestContext);
    // provision new aws account in existing Organization in master account
    this.print('getting awsorgservice');
    const awsOrgService = await this.getOrganizationService();
    this.print('getting accountname and email');
    const [AccountName, Email] = await Promise.all([
      this.payload.string('accountName'),
      this.payload.string('accountEmail'),
    ]);
    const params = {
      AccountName,
      Email,
    };
    this.print(`Attempting to create AWS account with ${JSON.stringify(params)}`);
    let creationResult;
    try {
      // TODO: handle if email address is already been used for another aws account
      creationResult = await awsOrgService.createAccount(params).promise();
      this.print(`setting the request id as ${creationResult.CreateAccountStatus.Id}`);
      this.state.setKey('REQUEST_ID', creationResult.CreateAccountStatus.Id);
    } catch (e) {
      this.print(`Error in creating account ${e.stack}`);
      throw new Error(`Create AWS Account operation error: ${e.stack}`);
    }

    this.print(`Waiting for Account creation process with requestID: ${await this.state.string('REQUEST_ID')}`);
    // wait until the account creation is finished
    return this.wait(10)
      .maxAttempts(120)
      .until('checkAccountCreationCompleted')
      .thenCall('saveAccountToDb');
  }

  async saveAccountToDb() {
    this.print('start to save account info into Dynamo');
    const requestContext = await this.payload.object('requestContext');
    const accountName = await this.payload.string('accountName');
    const email = await this.payload.string('accountEmail');
    // After the account is created
    await this.describeAccount();
    const accountId = await this.state.string('ACCOUNT_ID');
    const accountArn = await this.state.string('ACCOUNT_ARN');

    this.print(`Account creation process finish. New aws accountID: ${accountId}. ARN: ${accountArn}`);
    const [accountService] = await this.mustFindServices(['accountService']);
    this.print('got accountservice');
    const data = {
      accountName,
      email,
      accountArn,
      // TODO: check if roleName and iamUserAccessToBillion is specified by user, keep them default and skip saving them for now
    };
    this.print(`saving account data into dynamo: ${JSON.stringify(data)}`);
    await accountService.saveAccountToDb(requestContext, data, accountId);
    // THIS IS NEEDED, we should wait AWS to setup the account, even if we can fetch the account ID
    this.print('start to wait for 5min for AWS getting the account ready.');
    return this.wait(60 * 5).thenCall('deployStack');
  }

  async deployStack() {
    this.print('start to deploy initial stacks in newly created AWS account');

    const requestContext = await this.payload.object('requestContext');
    const by = _.get(requestContext, 'principalIdentifier');
    const ExternalId = await this.payload.string('externalId');
    const [workflowRoleArn, apiHandlerArn] = await Promise.all([
      this.payload.string('workflowRoleArn'),
      this.payload.string('apiHandlerArn'),
    ]);
    const centralAccountId = await this.state.string('ACCOUNT_ID');
    // deploy basic stacks to the account just created
    const [cfnTemplateService] = await this.mustFindServices(['cfnTemplateService']);
    const cfn = await this.getCloudFormationService();

    const [template] = await Promise.all([cfnTemplateService.getTemplate('onboard-account')]);
    const stackName = `initial-stack-${new Date().getTime()}`;
    const cfnParams = [];
    const addParam = (key, v) => cfnParams.push({ ParameterKey: key, ParameterValue: v });

    addParam('Namespace', stackName);
    addParam('CentralAccountId', centralAccountId);
    addParam('ExternalId', ExternalId);
    // TODO: consider if following params are needed
    // addParam('TrustUserArn', userArn);
    addParam('WorkflowRoleArn', workflowRoleArn);
    addParam('ApiHandlerArn', apiHandlerArn);

    addParam('LaunchConstraintRolePrefix', this.settings.get(settingKeys.launchConstraintRolePrefix));
    addParam('LaunchConstraintPolicyPrefix', this.settings.get(settingKeys.launchConstraintPolicyPrefix));

    const input = {
      StackName: stackName,
      Parameters: cfnParams,
      Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      TemplateBody: template,
      Tags: [
        {
          Key: 'Description',
          Value: `Created by ${by.username} for newly created AWS account`,
        },
        {
          Key: 'CreatedBy',
          Value: by.username,
        },
      ],
    };
    const response = await cfn.createStack(input).promise();

    // Update workflow state and poll for stack creation completion
    this.state.setKey('STATE_STACK_ID', response.StackId);
    await this.updateAccount({ stackId: response.StackId });
    return this.wait(20)
      .maxAttempts(120)
      .until('checkCfnCompleted');
  }

  async checkCfnCompleted() {
    const requestContext = await this.payload.object('requestContext');
    const stackId = await this.state.string('STATE_STACK_ID');
    const cfn = await this.getCloudFormationService();
    const stackInfo = (await cfn.describeStacks({ StackName: stackId }).promise()).Stacks[0];

    if (STACK_FAILED.includes(stackInfo.StackStatus)) {
      throw new Error(`Stack operation failed with message: ${stackInfo.StackStatusReason}`);
    } else if (STACK_SUCCESS.includes(stackInfo.StackStatus)) {
      // handle the case where the cloudformation is deleted before the creation could finish
      if (stackInfo.StackStatus !== 'DELETE_COMPLETE') {
        const cfnOutputs = this.getCfnOutputs(stackInfo);
        this.print('updating stack deployed completed');

        // create S3 and KMS resources access for newly created account
        await this.updateLocalResourcePolicies();

        await this.updateAccount({
          status: 'COMPLETED',
          cfnInfo: {
            stackId,
            vpcId: cfnOutputs.VPC,
            subnetId: cfnOutputs.VpcPublicSubnet1,
            crossAccountExecutionRoleArn: cfnOutputs.CrossAccountExecutionRoleArn,
            crossAccountEnvMgmtRoleArn: cfnOutputs.CrossAccountEnvMgmtRoleArn,
            encryptionKeyArn: cfnOutputs.EncryptionKeyArn,
          },
        });
        // TODO: after the account is deployed and all useful info is fetched,
        // try to update aws account table, it might be able to skip that table with all info already
        // exsiting in the account table instead of aws-account table. but for now, update the info to aws-account
        // ddb as well for code consistant reason.
        const [description, externalId, name] = await Promise.all([
          this.payload.string('description'),
          this.payload.string('externalId'),
          this.payload.string('accountName'),
        ]);
        this.print('saving account info into aws account table');
        const accountId = await this.state.string('ACCOUNT_ID');
        const awsAccountData = {
          accountId,
          description,
          externalId,
          name,
          roleArn: cfnOutputs.CrossAccountExecutionRoleArn,
          xAccEnvMgmtRoleArn: cfnOutputs.CrossAccountEnvMgmtRoleArn,
          subnetId: cfnOutputs.VpcPublicSubnet1,
          vpcId: cfnOutputs.VPC,
          encryptionKeyArn: cfnOutputs.EncryptionKeyArn,
        };
        await this.addAwsAccountTable(requestContext, awsAccountData);
      }
      return true;
    } // else CFN is still pending
    return false;
  }

  async addAwsAccountTable(requestContext, awsAccountData) {
    const [awsAccountsService] = await this.mustFindServices(['awsAccountsService']);
    await awsAccountsService.create(requestContext, awsAccountData);
  }

  async checkAccountCreationCompleted() {
    this.print('checking if the AWS account is created');
    const awsOrgService = await this.getOrganizationService();

    const requestId = await this.state.string('REQUEST_ID');
    const params = {
      CreateAccountRequestId: requestId,
    };
    let CreateAccountStatus;
    try {
      CreateAccountStatus = await awsOrgService.describeCreateAccountStatus(params).promise();
    } catch (e) {
      throw new Error(`checkAccountCreationCompleted operation error: ${e.stack}`);
    }
    /* response example:
      data = {
        CreateAccountStatus: {
        AccountId: "333333333333", 
        Id: "car-exampleaccountcreationrequestid", 
        State: "SUCCEEDED"
        }
      }
      */

    if (CreateAccountStatus.CreateAccountStatus.State === 'SUCCEEDED') {
      this.print(
        `account is successfully created with account_id: ${CreateAccountStatus.CreateAccountStatus.AccountId}`,
      );
      this.state.setKey('ACCOUNT_ID', CreateAccountStatus.CreateAccountStatus.AccountId);
      return true;
    }

    return false;
  }

  async updateAccount(obj) {
    const accountService = await this.mustFindServices('accountService');
    const id = await this.state.string('ACCOUNT_ID');
    const requestContext = await this.state.optionalObject('STATE_REQUEST_CONTEXT');
    const account = _.clone(obj);
    account.id = id;
    this.print(`updating account table with info: ${JSON.stringify(account)}`);
    await accountService.update(requestContext, account);
  }

  async onFail() {
    await this.updateAccount({ status: 'FAILED' });
  }

  async describeAccount() {
    const awsOrgService = await this.getOrganizationService();
    const AccountId = await this.state.string('ACCOUNT_ID');
    const params = {
      AccountId,
    };
    let account;
    try {
      account = await awsOrgService.describeAccount(params).promise();
      this.print(`setting account_arn as ${account.Account.Arn}`);
      this.state.setKey('ACCOUNT_ARN', account.Account.Arn);
    } catch (e) {
      throw new Error(`Describe AWS Account operation error: ${e.stack}`);
    }

    /* response example
    data = {
      Account: {
      Arn: "arn:aws:organizations::111111111111:account/o-exampleorgid/555555555555", 
      Email: "anika@example.com", 
      Id: "555555555555", 
      Name: "Beta Account"
      }
    }
    */
  }

  async getCloudFormationService() {
    const [aws] = await this.mustFindServices(['aws']);
    const credential = await this.getCredentials();
    const [requestContext, ExternalId] = await Promise.all([
      this.payload.object('requestContext'),
      this.payload.string('externalId'),
    ]);
    const accountId = await this.state.string('ACCOUNT_ID');
    // TODO: pass user customized role name, for now it's fixed as OrganizationAccountAccessRole
    const RoleArn = `arn:aws:iam::${accountId}:role/OrganizationAccountAccessRole`;
    const sts = new aws.sdk.STS(credential);
    const {
      Credentials: { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken },
    } = await sts
      .assumeRole({
        RoleArn,
        RoleSessionName: `RaaS-${requestContext.principalIdentifier.username}-CfnRole`,
        ExternalId,
      })
      .promise();

    return new aws.sdk.CloudFormation({ accessKeyId, secretAccessKey, sessionToken });
  }

  async getOrganizationService() {
    const [aws] = await this.mustFindServices(['aws']);
    const [requestContext, ExternalId, RoleArn] = await Promise.all([
      this.payload.object('requestContext'),
      this.payload.string('externalId'),
      this.payload.string('masterRoleArn'),
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

    // Organizations only has an endpoint in us-east-1
    return new aws.sdk.Organizations({ accessKeyId, secretAccessKey, sessionToken, region: 'us-east-1' });
  }

  async getCredentials() {
    const [aws] = await this.mustFindServices(['aws']);
    const [requestContext, RoleArn, ExternalId] = await Promise.all([
      this.payload.object('requestContext'),
      this.payload.string('masterRoleArn'),
      this.payload.string('externalId'),
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

  getCfnOutputs(stackInfo) {
    const details = {};
    stackInfo.Outputs.forEach(option => {
      _.set(details, option.OutputKey, option.OutputValue);
    });
    return details;
  }

  async getPolicy(s3Client, s3BucketName) {
    try {
      return JSON.parse((await s3Client.getBucketPolicy({ Bucket: s3BucketName }).promise()).Policy);
    } catch (error) {
      // if no policy yet, return an empty one
      if (error.code === 'NoSuchBucketPolicy') {
        return {
          Id: 'Policy',
          Version: '2012-10-17',
          Statement: [],
        };
      }
      throw error;
    }
  }

  /**
   * Post-Launch Tasks
   */
  async updateLocalResourcePolicies() {
    /**
     * Update S3 bucket policy and KMS key policy to grant access for newly created account
     * TODO: Consolidate some of this logic with the associated function in the DeleteEnvironment
     *       workflow step if possible
     */
    // Get new account ID
    const accountId = await this.state.string('ACCOUNT_ID');
    const remoteAccountArn = `arn:aws:iam::${accountId}:root`;
    // Get S3 and KMS resource names
    const s3BucketName = this.settings.get(settingKeys.artifactsBucketName);

    // Setup services and SDK clients
    const [aws, lockService] = await this.mustFindServices(['aws', 'lockService']);
    const s3Client = new aws.sdk.S3();

    // Define function to handle updating resource policy principals where the current principals
    // may be an array or a string
    const updateAwsPrincipals = (awsPrincipals, newPrincipal) => {
      if (Array.isArray(awsPrincipals)) {
        awsPrincipals.push(newPrincipal);
      } else {
        awsPrincipals = [awsPrincipals, newPrincipal];
      }
      return awsPrincipals;
    };

    // Perform locked updates to prevent inconsistencies from race conditions
    const s3LockKey = `s3|bucket-policy|${accountId}`;
    await Promise.all([
      // Update S3 bucket policy
      lockService.tryWriteLockAndRun({ id: s3LockKey }, async () => {
        // Get existing policy
        const s3Policy = await this.getPolicy(s3Client, s3BucketName);
        // Get statements for listing and reading study data, respectively
        const statements = s3Policy.Statement;
        const accessSid = `accessId:${accountId}`;
        // Define default statements to be used if we can't find existing ones
        let accessStatement = {
          Sid: accessSid,
          Effect: 'Allow',
          Principal: { AWS: [] },
          Action: ['s3:GetObject', 's3:PutObject', 's3:GetObjectAcl'],
          Resource: [`arn:aws:s3:::${s3BucketName}/*`], // The previous star-slash confuses some syntax highlighers */
        };

        // Pull out existing statements if available
        statements.forEach(statement => {
          if (statement.Sid === accessSid) {
            accessStatement = statement;
          }
        });

        // Update statement and policy
        // NOTE: The S3 API *should* remove duplicate principals, if any
        accessStatement.Principal.AWS = updateAwsPrincipals(accessStatement.Principal.AWS, remoteAccountArn);

        s3Policy.Statement = s3Policy.Statement.filter(statement => ![accessSid].includes(statement.Sid));
        s3Policy.Statement.push(accessStatement);

        // Update policy
        await s3Client.putBucketPolicy({ Bucket: s3BucketName, Policy: JSON.stringify(s3Policy) }).promise();
      }),
    ]);
  }
}

module.exports = ProvisionAccount;
