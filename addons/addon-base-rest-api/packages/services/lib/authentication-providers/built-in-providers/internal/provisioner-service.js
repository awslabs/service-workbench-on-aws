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
