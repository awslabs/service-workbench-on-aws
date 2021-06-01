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

    const { roleArn, stack: cfnStackName, mainRegion } = accountEntity;
    // const roleName = `${qualifier}-app-role-stack`;
    const cfnApi = await this.getCfnSdk(roleArn, mainRegion);
    const params = { StackName: cfnStackName };
    const stacks = await cfnApi.describeStacks(params).promise();
    const stack = _.find(_.get(stacks, 'Stacks', []), item => item.StackName === cfnStackName);

    if (_.isEmpty(stack)) {
      throw this.boom.notFound(`Stack '${cfnStackName}' not found`, true);
    }

    const stackId = stack.StackId;
    const permissionsTemplateStr = stack.Parameters;
    const permissionsTemplate = _.isEmpty(permissionsTemplateStr) ? {} : JSON.parse(permissionsTemplateStr);
    return {
      stackId,
      permissions: permissionsTemplate,
    };
  }

  // @private
  async getCfnSdk(roleArn, region) {
    const aws = await this.service('aws');
    try {
      const cfnClient = await aws.getClientSdkForRole({ roleArn, clientName: 'CloudFormation', options: { region } });
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
