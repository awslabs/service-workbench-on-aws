const InternalAuthenticationProviderService = require('./built-in-providers/internal/provider-service');
const CognitoUserPoolAuthenticationProviderService = require('./built-in-providers/cogito-user-pool/provider-service');
const UserAttributesMapperService = require('./built-in-providers/cogito-user-pool/user-attributes-mapper-service');
const ApiKeyService = require('./built-in-providers/internal/api-key-service');

function registerBuiltInAuthProviders(container) {
  // --- INTERNAL AUTHENTICATION PROVIDER RELATED --- //
  // internal - provider
  container.register('internalAuthenticationProviderService', new InternalAuthenticationProviderService());
  // The api key authentication is always through the internal provider
  container.register('apiKeyService', new ApiKeyService());

  // --- COGNITO USER POOL AUTHENTICATION PROVIDER RELATED --- //
  // cognito user pool - provider
  container.register(
    'cognitoUserPoolAuthenticationProviderService',
    new CognitoUserPoolAuthenticationProviderService(),
  );
  container.register('userAttributesMapperService', new UserAttributesMapperService());
}

module.exports = registerBuiltInAuthProviders;
