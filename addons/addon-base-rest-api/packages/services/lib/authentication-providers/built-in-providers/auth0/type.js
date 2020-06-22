const { inputManifestForCreate } = require('./create-auth0-idp-input-manifest');
const { inputManifestForUpdate } = require('./update-auth0-idp-input-manifest');
// TODO: Maybe we need to extend the setup later, if we need further config
// const inputSchema = require('./create-auth0-idp-schema');

module.exports = {
  type: 'auth0',
  title: 'Auth0 Identity Provider',
  description: 'Authentication provider for Auth0',
  config: {
    // credentialHandlingType indicating credential handling for the authentication provider
    // Possible values:
    // 'submit' -- The credentials should be submitted to the URL provided by the authentication provider
    // 'redirect' -- The credentials should be NOT be collected and the user should be redirected directly to the
    // URL provided by the authentication provider. For example, in case of SAML auth, the username/password
    // should not be collected by the service provider but the user should be redirected to the identity provider
    credentialHandlingType: 'redirect',

    // "inputSchema": JSON schema representing inputs required from user when configuring an authentication provider of this type.
    inputSchema: {
      definitions: {},
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'http://example.com/root.json',
      type: 'object',
      required: ['id', 'auth0Domain', 'auth0ClientId'],
      properties: {
        id: {
          $id: '#/properties/id',
          type: 'string',
        },
        title: {
          $id: '#/properties/title',
          type: 'string',
        },
        auth0Domain: {
          $id: '#/properties/auth0Domain',
          type: 'string',
        },
        auth0ClientId: {
          $id: '#/properties/auth0ClientId',
          type: 'string',
        },
      },
    },

    // The "inputManifest*" will be used on the UI to ask configuration inputs from the user when registering new
    // authentication provider
    inputManifestForCreate,
    inputManifestForUpdate,
    impl: {
      // In case of Auth0, the ID token is issued by the
      // the tokenIssuerLocator is not applicable in this case
      // tokenIssuerLocator: '',

      // Similar to the tokenIssuerLocator mentioned above but used for token validation instead of issuing token.
      // The token validation locator is used to validate token upon each request.
      // Unlike the tokenIssuerLocator which is only used for authentication being performed via application APIs, the
      // tokenValidatorLocator is used in all cases
      tokenValidatorLocator: 'locator:service:auth0AuthenticationProviderService/validateToken',
      tokenRevokerLocator: 'locator:service:internalAuthenticationProviderService/revokeToken',
      // Similar to above locators. The provisionerLocator identifies an implementation that takes care of provisioning the authentication provider.
      // In case of Internal Authentication Provider this "provisioning" step may be as simple as adding authentication provider configuration in Data Base.
      // In case of other auth providers, this step may be more elaborate (for example, in case of Cognito + SAML, the provisioner has to create Cognito User Pool,
      // configure cognito client application, configure SAML identity providers in the Cognito User Pool etc.
      provisionerLocator: 'locator:service:auth0AuthenticationProvisionerService/createUserIfDoesntExist',
    },
  },
};
