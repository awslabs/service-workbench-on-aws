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

// const { generateId } = require('../helpers/utils');

/**
 * This service is responsible for managing CFN stacks that provision AWS account permissions
 */

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
    ]);
  }

  async init() {
    await super.init();
  }

  /**
   * Queries the stack at the data source AWS account and returns the following object:
   * { stackId, templateId, templateVer, at }
   *
   * An exception is thrown if an error occurs while trying to describe the stack. This could happen if the stack
   * is not created yet or is not provisioned in the correct account and region or was provisioned but did not
   * use the correct stack name.
   *
   * @param requestContext
   * @param accountEntity
   */
  async getStackTemplate(requestContext, accountEntity) {
    await this.assertAuthorized(
      requestContext,
      { action: 'query-aws-cfn-stack', conditions: [allowIfActive, allowIfAdmin] },
      { accountEntity },
    );

    const { xAccEnvMgmtRoleArn, cfnStackName, mainRegion, externalId } = accountEntity;
    const cfnApi = await this.getCfnSdk(xAccEnvMgmtRoleArn, externalId, mainRegion);
    const params = { StackName: cfnStackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${cfnStackName}' not found`, true);
    }

    // Not sure yet how we'll deal with YAML vs. JSON, no easy way to convert
    // for now I think it's safe to assume it'll be YAML
    const permissionsTemplateRaw = await cfnApi.getTemplate(params).promise();

    return {
      permissionsTemplateStr: permissionsTemplateRaw.TemplateBody,
    };
  }

  async checkAccountPermissions(requestContext, accountEntity) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions', conditions: [allowIfActive, allowIfAdmin] },
      { accountEntity },
    );
    const [cfnTemplateService] = await this.service(['cfnTemplateService']);
    const expectedTemplate = await cfnTemplateService.getTemplate('onboard-account');

    // hashing the values for an easier comparison
    // not sure if this is really necessary, since string equivalence would also do the trick at this point
    // whitespace and comments removed before hashing
    // benefit of hashes is we can return them without worry about exposing information
    const curPermissions = await this.getStackTemplate(requestContext, accountEntity);
    const trimmedCurPermString = curPermissions.permissionsTemplateStr.replace(/#.*/g, ''); // .replace(/\s+/g, '');
    const trimmedExpPermString = expectedTemplate.replace(/#.*/g, ''); // .replace(/\s+/g, '');
    const sameLength = trimmedCurPermString.length === trimmedExpPermString.length;
    return {
      needsUpdate: trimmedExpPermString !== trimmedCurPermString,
      addedInformation: !this.stringInOther(trimmedCurPermString, trimmedExpPermString) && !sameLength,
      removedInformation: !this.stringInOther(trimmedExpPermString, trimmedCurPermString) && !sameLength,
      expLength: trimmedExpPermString.length,
      curLength: trimmedCurPermString.length,
    };
  }

  stringInOther(s1, s2) {
    let j = 1;
    for (let i = 0; i < s2.length; i += 1) {
      if (s1.charAt(j - 1) === s2.charAt(i)) {
        j += 1;
      }
    }
    return j === s1.length;
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
