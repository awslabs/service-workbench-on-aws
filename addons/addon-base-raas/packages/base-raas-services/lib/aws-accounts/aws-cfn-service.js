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
const crypto = require('crypto');

const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

// const { generateId } = require('../helpers/utils');

/**
 * This service is responsible for managing CFN stacks that provision AWS account permissions
 */

const settingKeys = {
  awsRegion: 'awsRegion',
  envBootstrapBucket: 'envBootstrapBucketName',
  apiHandlerRoleArn: 'apiHandlerArn',
  workflowLoopRunnerRoleArn: 'workflowRoleArn',
  swbMainAccount: 'mainAcct',
  stage: 'envName',
  isAppStreamEnabled: 'isAppStreamEnabled',
  domainName: 'domainName',
};

// see https://github.com/rvedotrc/aws-cloudformation-stack-states for all states
const PENDING_STATES = [
  'CREATE_IN_PROGRESS',
  'UPDATE_IN_PROGRESS',
  'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'REVIEW_IN_PROGRESS',
];
const COMPLETE_STATES = ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'];
const FAILED_STATES = ['CREATE_FAILED', 'UPDATE_FAILED', 'ROLLBACK_FAILED'];

const getCreateStackUrl = (cfnTemplateInfo, createParams) => {
  // see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stacks-quick-create-links.html
  const { name, region, signedUrl } = cfnTemplateInfo;
  const {
    apiHandlerRoleArn,
    workflowLoopRunnerRoleArn,
    mainAcct,
    externalId,
    namespace,
    appStreamFleetType,
    appStreamDisconnectTimeoutSeconds,
    appStreamFleetDesiredInstances,
    appStreamIdleDisconnectTimeoutSeconds,
    appStreamImageName,
    appStreamInstanceType,
    appStreamMaxUserDurationSeconds,
    enableAppStream,
    domainName,
  } = createParams;
  const url = [
    `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create/review/`,
    `?templateURL=${encodeURIComponent(signedUrl)}`,
    `&stackName=${name}`,
    `&param_Namespace=${namespace}`,
    `&param_CentralAccountId=${mainAcct}`,
    `&param_ExternalId=${externalId}`,
    `&param_ApiHandlerArn=${apiHandlerRoleArn}`,
    `&param_WorkflowRoleArn=${workflowLoopRunnerRoleArn}`,
    `&param_AppStreamFleetType=${appStreamFleetType || 'ON_DEMAND'}`,
    `&param_AppStreamDisconnectTimeoutSeconds=${appStreamDisconnectTimeoutSeconds || '60'}`,
    `&param_AppStreamFleetDesiredInstances=${appStreamFleetDesiredInstances || '2'}`,
    `&param_AppStreamIdleDisconnectTimeoutSeconds=${appStreamIdleDisconnectTimeoutSeconds || '600'}`,
    `&param_AppStreamImageName=${appStreamImageName || ''}`,
    `&param_AppStreamInstanceType=${appStreamInstanceType || ''}`,
    `&param_AppStreamMaxUserDurationSeconds=${appStreamMaxUserDurationSeconds || '86400'}`,
    `&param_EnableAppStream=${enableAppStream || 'false'}`,
    `&param_DomainName=${domainName || ''}`,
  ].join('');

  // This one takes us directly to the review stage but will require that we access the cloudformation console first
  // const url = [
  //   `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create/review/`,
  //   `?templateURL=${encodeURIComponent(signedUrl)}`,
  //   `&stackName=${name}`,
  // ].join('');

  // This takes us to the create new page:
  // `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/new`,
  // Note that this doesn't populate parameters correctly

  return url;
};

const getUpdateStackUrl = cfnTemplateInfo => {
  const { stackId, region, signedUrl } = cfnTemplateInfo;

  if (_.isEmpty(stackId)) return undefined;

  const url = [
    `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/update/template`,
    `?stackId=${encodeURIComponent(stackId)}`,
    `&templateURL=${encodeURIComponent(signedUrl)}`,
  ].join('');

  return url;
};

const getCfnHomeUrl = cfnTemplateInfo => {
  const { region } = cfnTemplateInfo;

  return `https://console.aws.amazon.com/cloudformation/home?region=${region}`;
};

class AwsCfnService extends Service {
  constructor() {
    super();
    this.boom.extend(['notSupported', 400]);
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'authorizationService',
      'auditWriterService',
      'pluginRegistryService',
      'cfnTemplateService',
      'awsAccountsService',
      's3Service',
    ]);
  }

  async init() {
    await super.init();
  }

  /**
   * Queries the stack at the data source AWS account and returns the stack template as a string.
   *
   * An exception is thrown if an error occurs while trying to describe the stack. This could happen if the stack
   * is not created yet or is not provisioned in the correct account and region or was provisioned but did not
   * use the correct stack name.
   * @private
   * @param requestContext
   * @param accountEntity
   */
  async getStackTemplate(requestContext, accountEntity) {
    await this.assertAuthorized(
      requestContext,
      { action: 'query-aws-cfn-stack', conditions: [allowIfActive, allowIfAdmin] },
      { accountEntity },
    );
    const region = this.settings.get(settingKeys.awsRegion);
    const { onboardStatusRoleArn, cfnStackName, externalId } = accountEntity;
    const cfnApi = await this.getCfnSdk(onboardStatusRoleArn, externalId, region);
    const params = { StackName: cfnStackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${cfnStackName}' not found`, true);
    }

    const stackStatus = stack.StackStatus;
    const permissionsTemplateRaw = await cfnApi.getTemplate(params).promise();

    return { permString: permissionsTemplateRaw.TemplateBody, stackStatus };
  }

  async getAndUploadTemplateForAccount(requestContext, accountId) {
    await this.assertAuthorized(
      requestContext,
      { action: 'get-upload-cfn-template', conditions: [allowIfActive, allowIfAdmin] },
      { accountId },
    );
    const cfnTemplateInfo = {};
    const createParams = {};

    const awsAccountsService = await this.service('awsAccountsService');
    const cfnTemplateService = await this.service('cfnTemplateService');
    const s3Service = await this.service('s3Service');

    // Verify active Non-AppStream environments do not exist
    await awsAccountsService.checkForActiveNonAppStreamEnvs(requestContext, accountId);

    const account = await awsAccountsService.mustFind(requestContext, { id: accountId });
    cfnTemplateInfo.template = await cfnTemplateService.getTemplate('onboard-account');
    cfnTemplateInfo.region = this.settings.get(settingKeys.awsRegion);
    cfnTemplateInfo.name = account.cfnStackName || `initial-stack-${new Date().getTime()}`;
    cfnTemplateInfo.accountId = account.accountId;
    cfnTemplateInfo.stackId = account.cfnStackId;
    createParams.appStreamFleetType = account.appStreamFleetType;
    createParams.appStreamDisconnectTimeoutSeconds = account.appStreamDisconnectTimeoutSeconds;
    createParams.appStreamFleetDesiredInstances = account.appStreamFleetDesiredInstances;
    createParams.appStreamIdleDisconnectTimeoutSeconds = account.appStreamIdleDisconnectTimeoutSeconds;
    createParams.appStreamImageName = account.appStreamImageName;
    createParams.appStreamInstanceType = account.appStreamInstanceType;
    createParams.appStreamMaxUserDurationSeconds = account.appStreamMaxUserDurationSeconds;

    createParams.mainAcct = this.settings.get(settingKeys.swbMainAccount);
    createParams.apiHandlerRoleArn = this.settings.get(settingKeys.apiHandlerRoleArn);
    createParams.workflowLoopRunnerRoleArn = this.settings.get(settingKeys.workflowLoopRunnerRoleArn);
    createParams.enableAppStream = this.settings.get(settingKeys.isAppStreamEnabled);
    createParams.domainName = this.settings.optional(settingKeys.domainName, '');
    createParams.externalId = account.externalId;
    createParams.namespace = cfnTemplateInfo.name;

    // The id of the template is actually the hash of the of the content of the template
    const hash = crypto.createHash('sha256');
    hash.update(cfnTemplateInfo.template);
    cfnTemplateInfo.id = hash.digest('hex');

    // Upload to S3
    const bucket = this.settings.get(settingKeys.envBootstrapBucket);
    const key = `aws-accounts/acct-${account.id}/cfn/region/${cfnTemplateInfo.region}/${cfnTemplateInfo.id}.yml`;
    await s3Service.api
      .putObject({
        Body: cfnTemplateInfo.template,
        Bucket: bucket,
        Key: key,
      })
      .promise();

    // Sign the url
    // expireSeconds: 604800 /* seven days */, if we need 7 days, we need to use a real IAM user credentials.
    const expireSeconds = 12 * 60 * 60; // 12 hours
    const request = { files: [{ key, bucket }], expireSeconds };
    const urls = await s3Service.sign(request);
    const signedUrl = urls[0].signedUrl;

    cfnTemplateInfo.urlExpiry = Date.now() + expireSeconds * 1000;
    cfnTemplateInfo.signedUrl = signedUrl;
    cfnTemplateInfo.createStackUrl = getCreateStackUrl(cfnTemplateInfo, createParams);
    cfnTemplateInfo.updateStackUrl = getUpdateStackUrl(cfnTemplateInfo);
    cfnTemplateInfo.cfnConsoleUrl = getCfnHomeUrl(cfnTemplateInfo);

    // If we are onboarding the account for the first time, we have to populate some parameters for checking permissions later
    const updatedAcct = {
      id: account.id,
      rev: account.rev,
      cfnStackName: cfnTemplateInfo.name, // If SWB didn't generate a cfn name, this will be account.cfnStackName
      externalId: account.externalId,
      permissionStatus: 'PENDING',
      onboardStatusRoleArn: [
        'arn:aws:iam::',
        account.accountId,
        ':role/',
        createParams.namespace,
        '-cfn-status-role',
      ].join(''),
    };
    await awsAccountsService.update(requestContext, updatedAcct);

    return cfnTemplateInfo;
  }

  async checkAccountPermissions(requestContext, accountId) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions', conditions: [allowIfActive, allowIfAdmin] },
      { accountId },
    );

    const awsAccountsService = await this.service('awsAccountsService');
    const accountEntity = await awsAccountsService.mustFind(requestContext, { id: accountId });

    // Special case handling for accounts upgrading to this feature
    if (accountEntity.cfnStackName === '' || accountEntity.cfnStackName === undefined) {
      return 'UNKNOWN';
    }

    const [cfnTemplateService] = await this.service(['cfnTemplateService']);
    const expectedTemplate = await cfnTemplateService.getTemplate('onboard-account');

    const stackTemplate = await this.getStackTemplate(requestContext, accountEntity);
    const stackStatus = stackTemplate.stackStatus;

    // some statuses we can determine based on stack status
    if (PENDING_STATES.includes(stackStatus)) {
      return 'PENDING';
    }
    if (FAILED_STATES.includes(stackStatus)) {
      return 'ERRORED';
    }
    if (COMPLETE_STATES.includes(stackStatus)) {
      const curPermissions = stackTemplate.permString;
      // whitespace and comments removed before comparison
      const trimmedCurPermString = curPermissions.replace(/#.*/g, '').replace(/\s+/g, '');
      const trimmedExpPermString = expectedTemplate.replace(/#.*/g, '').replace(/\s+/g, '');

      // still hash values
      return trimmedExpPermString !== trimmedCurPermString ? 'NEEDS_UPDATE' : 'CURRENT';
    }

    // we should never make it here unless something really goes wrong
    return 'UNKNOWN';
  }

  async batchCheckAndUpdateAccountPermissions(requestContext, batchSize = 5) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions-batch', conditions: [allowIfActive, allowIfAdmin] },
      {},
    );

    const awsAccountsService = await this.service('awsAccountsService');
    const accountsList = await awsAccountsService.list();

    const newStatus = {};
    const errors = {};
    const idList = accountsList.forEach(account => account.accountId);
    let res;
    let errorMsg = '';

    const checkPermissions = async account => {
      errorMsg = '';
      if (
        account.permissionStatus === 'NEEDS_ONBOARD' ||
        account.permissionStatus === 'PENDING' // Backend lambda will bring the account out of PENDING
      ) {
        res = account.permissionStatus;
      } else {
        try {
          res = await this.checkAccountPermissions(requestContext, account.id);
        } catch (e) {
          res = 'ERRORED';
          errorMsg = e.safe // if error is boom error then see if it is safe to propagate its message
            ? `Error checking permissions for account ${account.accountId}. ${e.message}`
            : `Error checking permissions for account ${account.accountId}`;
        }
      }

      if (errorMsg !== '') {
        this.log.error(errorMsg);
        errors[account.id] = errorMsg;
      }

      newStatus[account.id] = res;
      if (res !== account.permissionStatus) {
        const updatedAcct = {
          id: account.id,
          rev: account.rev,
          roleArn: account.roleArn,
          externalId: account.externalId,
          permissionStatus: res,
        };
        try {
          await awsAccountsService.update(requestContext, updatedAcct);
        } catch (e) {
          this.log.error(e.message);
          // Status check can only proceed if the error is related to active non-AppStream envs
          if (
            e.message !==
            'This account has active non-AppStream environments. Please terminate them and retry this operation'
          ) {
            throw e;
          }
        }
      }
    };

    // Check permissions in parallel in the specified batches
    await processInBatches(accountsList, batchSize, checkPermissions);

    // Attempt to onboard any pending accounts
    const pendingRes = await this.onboardPendingAccounts(requestContext);
    const finalStatus = { ...newStatus, ...pendingRes.newStatus };
    const statusInfo = { ...errors, ...pendingRes.auditLog };
    await this.audit(requestContext, {
      action: 'check-aws-permissions-batch',
      body: {
        totalAccounts: _.size(accountsList),
        usersChecked: idList,
        statusMsgs: statusInfo,
      },
    });
    return { finalStatus, statusInfo };
  }

  // @private
  async getCfnSdk(onboardStatusRoleArn, externalId, region) {
    const aws = await this.service('aws');
    try {
      const cfnClient = await aws.getClientSdkForRole({
        roleArn: onboardStatusRoleArn,
        externalId,
        clientName: 'CloudFormation',
        options: { region },
      });
      return cfnClient;
    } catch (error) {
      throw this.boom.forbidden(`Could not assume a role to check the stack status`, true).cause(error);
    }
  }

  async onboardPendingAccounts(requestContext) {
    const awsAccountsService = await this.service('awsAccountsService');
    const accounts = await awsAccountsService.list();
    const pendingAccountIds = _.map(
      _.filter(accounts, acct => acct.permissionStatus === 'PENDING'),
      'id',
    );

    const auditLog = {};
    const newStatus = {};

    const onboardAccount = async awsAccountId => {
      try {
        await this.finishOnboardingAccount(requestContext, awsAccountId);
        auditLog[awsAccountId] = 'Successfully Onboarded';
        newStatus[awsAccountId] = 'CURRENT';
      } catch (e) {
        auditLog[awsAccountId] = `Account is not ready yet. ${e}`;
        newStatus[awsAccountId] = 'PENDING';
      }
    };

    // For each account, reach out 10 at a time
    if (!_.isEmpty(pendingAccountIds)) {
      await processInBatches(pendingAccountIds, 10, onboardAccount);
    }

    return { auditLog, newStatus };
  }

  async finishOnboardingAccount(requestContext, accountId) {
    const awsAccountsService = await this.service('awsAccountsService');
    const accountEntity = await awsAccountsService.mustFind(requestContext, { id: accountId });

    const region = this.settings.get(settingKeys.awsRegion);
    const { onboardStatusRoleArn, cfnStackName, externalId } = accountEntity;
    const cfnApi = await this.getCfnSdk(onboardStatusRoleArn, externalId, region);
    const params = { StackName: cfnStackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${cfnStackName}' not found`, true);
    }

    if (PENDING_STATES.includes(stack.StackStatus)) {
      throw this.boom.badRequest(`Stack '${cfnStackName}' is still pending.`, true);
    }

    const fieldsToUpdate = {};
    const findOutputValue = prop => {
      const output = _.find(_.get(stack, 'Outputs', []), item => item.OutputKey === prop);
      return output.OutputValue;
    };

    fieldsToUpdate.cfnStackId = stack.StackId;
    fieldsToUpdate.externalId = accountEntity.externalId;
    fieldsToUpdate.vpcId = findOutputValue('VPC');
    fieldsToUpdate.encryptionKeyArn = findOutputValue('EncryptionKeyArn');
    fieldsToUpdate.roleArn = findOutputValue('CrossAccountExecutionRoleArn');
    fieldsToUpdate.xAccEnvMgmtRoleArn = findOutputValue('CrossAccountEnvMgmtRoleArn');
    fieldsToUpdate.permissionStatus = 'CURRENT'; // If we just onboarded it's safe to assume the account is up to date
    // we have to update the permission status or the account will get stuck in PENDING
    fieldsToUpdate.id = accountEntity.id;
    fieldsToUpdate.rev = accountEntity.rev;

    if (this.settings.getBoolean(settingKeys.isAppStreamEnabled)) {
      fieldsToUpdate.subnetId = findOutputValue('PrivateWorkspaceSubnet');
      fieldsToUpdate.appStreamStackName = findOutputValue('AppStreamStackName');
      fieldsToUpdate.appStreamFleetName = findOutputValue('AppStreamFleet');
      fieldsToUpdate.appStreamSecurityGroupId = findOutputValue('AppStreamSecurityGroup');
      if (this.settings.optional(settingKeys.domainName, '') !== '') {
        fieldsToUpdate.route53HostedZone = findOutputValue('Route53HostedZone');
      }
    } else {
      fieldsToUpdate.subnetId = findOutputValue('VpcPublicSubnet1');
    }

    await awsAccountsService.update(requestContext, fieldsToUpdate);

    // TODO Start AppStream fleet
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'aws-account-authz', action, conditions },
      ...args,
    );
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

module.exports = AwsCfnService;
