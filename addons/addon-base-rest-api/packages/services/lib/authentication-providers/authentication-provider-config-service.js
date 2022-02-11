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
const authProviderConstants = require('./constants').authenticationProviders;

const settingKeys = {
  tableName: 'dbAuthenticationProviderConfigs',
};

const serializeProviderConfig = providerConfig => JSON.stringify(providerConfig);
const deSerializeProviderConfig = providerConfigStr => JSON.parse(providerConfigStr);

const toProviderConfig = dbResultItem =>
  _.assign({}, dbResultItem, {
    config: dbResultItem && deSerializeProviderConfig(dbResultItem.config),
  });

class AuthenticationProviderConfigService extends Service {
  constructor() {
    super();
    this.dependency(['dbService', 'jsonSchemaValidationService']);
  }

  async getAuthenticationProviderConfigs(fields = []) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    const dbResults = await dbService.helper
      .scanner()
      .table(table)
      .projection(fields)
      .scan();
    return _.map(dbResults, toProviderConfig);
  }

  async getAuthenticationProviderConfig(providerId, fields = []) {
    if (providerId === 'internal') {
      throw this.boom.badRequest(
        'Internal users cannot log in. Please use an external IdP or native Cognito user pool user.',
        true,
      );
    }
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    const dbResult = await dbService.helper
      .getter()
      .table(table)
      .key({ id: providerId })
      .projection(fields)
      .get();
    return dbResult && toProviderConfig(dbResult);
  }

  async exists(providerId) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    const item = await dbService.helper
      .getter()
      .table(table)
      .key({ id: providerId })
      .get();

    if (item === undefined) return false;
    return true;
  }

  async saveAuthenticationProviderConfig({
    providerTypeConfig,
    providerConfig,
    status = authProviderConstants.status.initializing,
  }) {
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    const providerConfigJsonSchema = _.get(providerTypeConfig, 'config.inputSchema');

    // Validate input
    await jsonSchemaValidationService.ensureValid(providerConfig, providerConfigJsonSchema);

    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    providerConfig.type = providerTypeConfig;

    const dbResult = await dbService.helper
      .updater()
      .table(table)
      .key({ id: providerConfig.id })
      // save serialized providerConfig as JSON string
      // also set the "status" of the authentication provider as "initializing", by default
      // once the provisioning is complete, the status should be set to "active" by the subclasses
      .item({ config: serializeProviderConfig(providerConfig), status })
      .update();
    return dbResult && toProviderConfig(dbResult);
  }
}

module.exports = AuthenticationProviderConfigService;
