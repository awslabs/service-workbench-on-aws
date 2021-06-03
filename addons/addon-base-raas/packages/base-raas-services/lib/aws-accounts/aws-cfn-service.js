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
const crypto = require('crypto');
const Service = require('@aws-ee/base-services-container/lib/service');
// const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const fs = require('fs');

// const expectedTemplatePath = `${__dirname}/../../../../../../onboard-account-template.json`;
const expectedTemplatePath = `${__dirname}/../../../../../../onboard-account-template.cfn.yml`;
const expectedTemplate = fs.existsSync(expectedTemplatePath) ? fs.readFileSync(expectedTemplatePath, 'utf-8') : '';

// const { generateId } = require('../helpers/utils');

/**
 * This service is responsible for managing CFN stacks that provision AWS account permissions
 */

class AwsCfnService extends Service {
  constructor() {
    super();
    this.boom.extend(['notSupported', 400]);
    this.dependency(['aws', 'jsonSchemaValidationService', 'authorizationService', 'auditWriterService']);
  }

  async init() {
    await super.init();
    // const [dbService] = await this.service(['dbService']);

    // this._getter = () => dbService.helper.getter().table(table);
    // this._updater = () => dbService.helper.updater().table(table);
    // this._query = () => dbService.helper.query().table(table);
    // this._deleter = () => dbService.helper.deleter().table(table);
    // this._scanner = () => dbService.helper.scanner().table(table);
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
  async queryStack(requestContext, accountEntity) {
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
    const stackId = stack.StackId;
    const permissionsTemplateRaw = await cfnApi.getTemplate(params).promise();

    return {
      stackId,
      permissionsTemplateStr: permissionsTemplateRaw.TemplateBody,
    };
  }

  async checkAccountPermissions(requestContext, accountEntity) {
    await this.assertAuthorized(
      requestContext,
      { action: 'check-aws-permissions', conditions: [allowIfActive, allowIfAdmin] },
      { accountEntity },
    );

    // hashing the values for an easier comparison
    // not sure if this is really necessary, since string equivalence would also do the trick at this point
    // whitespace removed because platform-specific differences lead to different hash values
    // benefit of hashes is we can return them without worry about exposing information
    const curPermissions = await this.queryStack(requestContext, accountEntity);
    const trimmedCurPermString = curPermissions.permissionsTemplateStr.replace(/#.*/g, '').replace(/\s+/g, '');
    const curPermHasher = crypto.createHash('sha256');
    curPermHasher.update(trimmedCurPermString);
    const curPermHash = curPermHasher.digest('hex');

    const expPermHasher = crypto.createHash('sha256');
    const trimmedExpPermString = expectedTemplate.replace(/#.*/g, '').replace(/\s+/g, '');
    expPermHasher.update(trimmedExpPermString);
    const expPermHash = expPermHasher.digest('hex');

    return {
      needsUpdate: curPermHash !== expPermHash,
      curPermHash,
      expPermHash,
    };
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
