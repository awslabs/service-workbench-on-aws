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

const Service = require('@amzn/base-services-container/lib/service');
const { isAllow, allowIfActive, allowIfAdmin } = require('@amzn/base-services/lib/authorization/authorization-utils');

/**
 * A service that provides various dynamic variables that can be used to map
 * CFN input parameters with values when creating env type configurations.
 *
 * The service introduces new extension point named "env-provisioning".
 *
 */
class EnvTypeConfigVarService extends Service {
  constructor() {
    super();
    this.dependency(['authorizationService', 'pluginRegistryService']);
  }

  /**
   * Returns a list of variables available when creating env type configurations
   * (i.e., when mapping AWS CloudFormation input params to values or mapping
   * the params to some dynamic variables)
   *
   * @param requestContext
   * @param envTypeId
   * @returns {Promise<void>}
   */
  async list(requestContext, envTypeId) {
    // ensure that the caller has permissions to list variables
    // Perform default condition checks to make sure the user is active and is admin
    const authorizedToListAllVars = await this.isAuthorized(requestContext, {
      action: 'list',
      conditions: [allowIfActive, allowIfAdmin],
    });
    if (!authorizedToListAllVars) {
      // return list with no vars, if the user is not authorized to list all variables
      return [];
    }

    const pluginRegistryService = await this.service('pluginRegistryService');

    // Give all plugins a chance to contribute to the list of variables
    const result = await pluginRegistryService.visitPlugins('env-provisioning', 'list', {
      payload: {
        requestContext,
        container: this.container,
        vars: [
          { name: 'awsRegion', desc: 'AWS Region where the platform is deployed' },
          {
            name: 'namespace',
            desc:
              'Unique namespace generated for the environment at the time of launching the environment. This is also ' +
              'used as AWS Service Catalog provisioned product name (in turn, used as AWS CloudFormation stack name) ' +
              'when provisioning the environment',
          },
        ],
      },
      envTypeId,
    });

    return result ? result.vars : [];
  }

  async isAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    return isAllow(
      await authorizationService.authorize(
        requestContext,
        { extensionPoint: 'env-provisioning-variables-list', action, conditions },
        ...args,
      ),
    );
  }
}
module.exports = EnvTypeConfigVarService;
