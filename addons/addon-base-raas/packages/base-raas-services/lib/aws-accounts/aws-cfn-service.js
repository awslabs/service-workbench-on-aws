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
// const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

// const { generateId } = require('../helpers/utils');

/**
 * This service is responsible for managing CFN stacks that provision AWS account permissions
 */

const settingKeys = {
  awsRegion: 'awsRegion',
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
      'cfnTemplateService',
      'awsAccountsService',
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
    const { xAccEnvMgmtRoleArn, cfnStackName, externalId } = accountEntity;
    const cfnApi = await this.getCfnSdk(xAccEnvMgmtRoleArn, externalId, region);
    const params = { StackName: cfnStackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${cfnStackName}' not found`, true);
    }

    const permissionsTemplateRaw = await cfnApi.getTemplate(params).promise();

    return permissionsTemplateRaw.TemplateBody;
  }

  async checkAccountPermissions(requestContext, accountId) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions', conditions: [allowIfActive, allowIfAdmin] },
      { accountId },
    );
    const awsAccountsService = await this.service('awsAccountsService');
    const accountEntity = await awsAccountsService.mustFind(requestContext, { id: accountId });

    const [cfnTemplateService] = await this.service(['cfnTemplateService']);
    const expectedTemplate = await cfnTemplateService.getTemplate('onboard-account');

    // whitespace and comments removed before comparison
    const curPermissions = await this.getStackTemplate(requestContext, accountEntity);
    const trimmedCurPermString = curPermissions.replace(/#.*/g, '').replace(/\s+/g, '');
    const trimmedExpPermString = expectedTemplate.replace(/#.*/g, '').replace(/\s+/g, '');

    // still hash values
    return trimmedExpPermString !== trimmedCurPermString ? 'NEEDSUPDATE' : 'CURRENT';
  }

  async batchCheckAccountPermissions(requestContext, batchSize = 5) {
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
      if (account.cfnStackName === '') {
        res = account.permissionStatus === 'NEEDSONBOARD' ? 'NEEDSONBOARD' : 'NOSTACKNAME';
        errorMsg = `Error: Account ${account.accountId} has no CFN stack name specified.`;
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
        await awsAccountsService.update(requestContext, updatedAcct);
      }
    };

    // Check permissions in parallel in the specified batches
    await processInBatches(accountsList, batchSize, checkPermissions);
    await this.audit(requestContext, {
      action: 'check-aws-permissions-batch',
      body: {
        totalAccounts: _.size(accountsList),
        usersChecked: idList,
        errors,
      },
    });
    return { newStatus, errors };
  }

  // @private
  async getCfnSdk(xAccEnvMgmtRoleArn, externalId, region) {
    const aws = await this.service('aws');
    try {
      const cfnClient = await aws.getClientSdkForRole({
        roleArn: xAccEnvMgmtRoleArn,
        externalId,
        clientName: 'CloudFormation',
        options: { region },
      });
      return cfnClient;
    } catch (error) {
      throw this.boom.forbidden(`Could not assume a role to check the stack status`, true).cause(error);
    }
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
