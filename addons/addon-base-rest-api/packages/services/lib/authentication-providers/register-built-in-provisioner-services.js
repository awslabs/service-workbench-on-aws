const InternalAuthenticationProvisionerService = require('./built-in-providers/internal/provisioner-service');
const CognitoUserPoolAuthenticationProvisionerService = require('./built-in-providers/cogito-user-pool/provisioner-service');

function registerBuiltInAuthProvisioners(container) {
  // --- INTERNAL AUTHENTICATION PROVIDER RELATED --- //
  // internal - provisioner
  container.register('internalAuthenticationProvisionerService', new InternalAuthenticationProvisionerService());

  // --- COGNITO USER POOL AUTHENTICATION PROVIDER RELATED --- //
  // cognito user pool - provider
  container.register(
    'cognitoUserPoolAuthenticationProvisionerService',
    new CognitoUserPoolAuthenticationProvisionerService(),
  );
}

module.exports = registerBuiltInAuthProvisioners;
