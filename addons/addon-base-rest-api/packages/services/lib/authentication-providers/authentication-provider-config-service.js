const Service = require('@aws-ee/base-services-container/lib/service');
const _ = require('lodash');
const authProviderConstants = require('./constants').authenticationProviders;

const settingKeys = {
  tableName: 'dbTableAuthenticationProviderConfigs',
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
