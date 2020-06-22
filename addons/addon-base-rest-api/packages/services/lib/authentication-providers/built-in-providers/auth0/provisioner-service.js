const Service = require('@aws-ee/base-services-container/lib/service');
const authProviderConstants = require('../../constants').authenticationProviders;

const settingKeys = {
  envName: 'envName',
  envType: 'envType',
  solutionName: 'solutionName',
  websiteUrl: 'websiteUrl',
};

class ProvisionerService extends Service {
  constructor() {
    super();
    this.dependency(['authenticationProviderConfigService']);
  }

  async provision({ providerTypeConfig, providerConfig }) {
    // We won't provision Auth0 accounts - this is intended for customers
    // who already use Auth0 and require its use for auth.
    // We do need to save the configuration in DB which is handled by authenticationProviderPublicConfigService
    this.log.info('Provisioning auth0 authentication provider');
    const authenticationProviderConfigService = await this.service('authenticationProviderConfigService');

    const providerConfigWithOutputs = providerConfig;
    const clientId = providerConfigWithOutputs.auth0ClientId;
    const websiteUrl = this.settings.get(settingKeys.websiteUrl);
    const auth0Domain = providerConfigWithOutputs.auth0Domain;
    // compose signIn uri
    // TODO: make nonce random
    const signInUri = `https://${auth0Domain}/authorize?response_type=id_token&scope=openid%20profile%20email&client_id=${clientId}&redirect_uri=${websiteUrl}&nonce=NONCE`;

    // Although this is not common practice, you can force the user to log out
    // of their identity provider. To do this, include the 'federated' query
    // parameter, as shown below. For IDPs that support this, it will cause an
    // additional redirect to the IDP and log the user out of both the Research
    // Portal and the user's IDP. We suppress this IDP logout, by defauilt.
    // const signOutUri = `https://${auth0Domain}/v2/logout?federated&client_id=${clientId}`;
    const signOutUri = `https://${auth0Domain}/v2/logout?client_id=${clientId}`;

    providerConfigWithOutputs.signInUri = signInUri;
    providerConfigWithOutputs.signOutUri = signOutUri;
    // have to reset the provider config id to mathch the id_token iss
    providerConfigWithOutputs.id = `https://${auth0Domain}/`;

    const result = await authenticationProviderConfigService.saveAuthenticationProviderConfig({
      providerTypeConfig,
      providerConfig: providerConfigWithOutputs,
      status: authProviderConstants.status.active,
    });
    return result;
  }
}

module.exports = ProvisionerService;
