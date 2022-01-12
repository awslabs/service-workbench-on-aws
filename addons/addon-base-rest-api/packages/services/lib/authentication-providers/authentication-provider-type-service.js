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

const Service = require('@aws-ee/base-services-container/lib/service');
const _ = require('lodash');

const cognitoUserPoolAuthenticationProviderType = require('./built-in-providers/cogito-user-pool/type');

class AuthenticationProviderTypeService extends Service {
  constructor() {
    super();
    this.dependency(['dbService', 'pluginRegistryService']);
  }

  async getAuthenticationProviderTypes(requestContext) {
    const types = [cognitoUserPoolAuthenticationProviderType];

    // Give all plugins a chance in registering their authentication provider types
    // Each plugin will receive the following payload object with the shape {requestContext, container, types}
    const pluginRegistryService = await this.service('pluginRegistryService');
    const result = await pluginRegistryService.visitPlugins('authentication-provider-type', 'registerTypes', {
      payload: { requestContext, container: this.container, types },
    });
    return result ? result.types : [];
  }

  async getAuthenticationProviderType(requestContext, providerTypeId) {
    const providerTypes = await this.getAuthenticationProviderTypes(requestContext);
    return _.find(providerTypes, { type: providerTypeId });
  }
}

module.exports = AuthenticationProviderTypeService;
