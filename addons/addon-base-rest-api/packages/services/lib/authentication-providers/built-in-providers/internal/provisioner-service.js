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
const authProviderConstants = require('../../constants').authenticationProviders;

class ProvisionerService extends Service {
  constructor() {
    super();
    this.dependency(['authenticationProviderConfigService']);
  }

  async provision({ providerTypeConfig, providerConfig }) {
    // There is nothing to do for internal auth provider provisioning
    // except for saving the configuration in DB which is handled by authenticationProviderPublicConfigService
    this.log.info('Provisioning internal authentication provider');
    const authenticationProviderConfigService = await this.service('authenticationProviderConfigService');
    const result = await authenticationProviderConfigService.saveAuthenticationProviderConfig({
      providerTypeConfig,
      providerConfig,
      status: authProviderConstants.status.active,
    });
    return result;
  }
}

module.exports = ProvisionerService;
