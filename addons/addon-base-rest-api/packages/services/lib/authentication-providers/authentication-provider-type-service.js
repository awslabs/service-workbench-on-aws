const Service = require('@aws-ee/base-services-container/lib/service');
const _ = require('lodash');

const internalAuthenticationProviderType = require('./built-in-providers/internal/type');
const cognitoUserPoolAuthenticationProviderType = require('./built-in-providers/cogito-user-pool/type');

class AuthenticationProviderTypeService extends Service {
  constructor() {
    super();
    this.dependency(['dbService']);
  }

  async getAuthenticationProviderTypes() {
    return [internalAuthenticationProviderType, cognitoUserPoolAuthenticationProviderType];
  }

  async getAuthenticationProviderType(providerTypeId) {
    const providerTypes = await this.getAuthenticationProviderTypes();
    return _.find(providerTypes, { type: providerTypeId });
  }

  // eslint-disable-next-line no-unused-vars
  async registerAuthenticationProviderType(authProviderTypeInfo) {
    // TODO: Add dynamic registration of types. Will be required when supporting custom authentication provider types
    // via plugin architecture where the new authentication provider types can be implemented via separate lambda functions
    // or apis
  }
}

module.exports = AuthenticationProviderTypeService;
