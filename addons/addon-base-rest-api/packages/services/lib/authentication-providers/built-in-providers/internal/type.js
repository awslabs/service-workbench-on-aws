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

module.exports = {
  type: 'internal',
  title: 'Internal',
  description:
    'This is a built-in internal authentication provider. ' +
    'The internal authentication provider uses an internal user directory for authenticating ' +
    'the users. This provider is only intended to be used for development and testing. It currently ' +
    'lacks many features required for production usage such as ability to force password rotations, ability ' +
    'to reset passwords, and support "forgot password" etc. For production use, please add other ' +
    'authentication provider with identity federation for production use.',
  config: {
    // credentialHandlingType indicating credential handling for the authentication provider
    // Possible values:
    // 'submit' -- The credentials should be submitted to the URL provided by the authentication provider
    // 'redirect' -- The credentials should be NOT be collected and the user should be redirected directly to the
    // URL provided by the authentication provider. For example, in case of SAML auth, the username/password
    // should not be collected by the service provider but the user should be redirected to the identity provider
    credentialHandlingType: 'submit',

    // "inputSchema": JSON schema representing inputs required from user when configuring an authentication provider of this type.
    inputSchema: {
      definitions: {},
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'http://example.com/root.json',
      type: 'object',
      required: ['id', 'title', 'signInUri'],
      properties: {
        id: {
          $id: '#/properties/id',
          type: 'string',
        },
        title: {
          $id: '#/properties/title',
          type: 'string',
        },
        signInUri: {
          $id: '#/properties/signInUri',
          type: 'string',
        },
        signOutUri: {
          $id: '#/properties/signOutUri',
          type: 'string',
        },
      },
    },

    // The "inputManifest" will be used on the UI to ask configuration inputs from the user when registering new
    // authentication provider
    inputManifestForCreate: {
      sections: [
        {
          title: 'General Information',
          children: [
            {
              name: 'id',
              type: 'stringInput',
              title: 'ID',
              rules: 'required|string|between:2,64|regex:/^[a-zA-Z][a-zA-Z0-9_-]+$/',
              desc:
                'This is a required field. This is used for uniquely identifying the authentication provider. ' +
                'It must be between 2 to 64 characters long and must start with an alphabet and may contain alpha numeric ' +
                'characters, underscores, and dashes. No other special symbols are allowed.',
            },
            {
              name: 'title',
              type: 'stringInput',
              title: 'Title',
              rules: 'required|between:3,255',
              desc: 'This is a required field and must be between 3 and 255 characters long.',
            },
            {
              name: 'signInUri',
              type: 'stringInput',
              title: 'Sign In URI',
              rules: 'required|between:3,255',
              desc: 'The Sign In URI that accepts username/password for signing in.',
            },
            {
              name: 'signOutUri',
              type: 'stringInput',
              title: 'Sign Out URI',
              rules: 'required|between:3,255',
              desc: 'The Sign Out URI to log out user.',
            },
          ],
        },
      ],
    },
    inputManifestForUpdate: {
      sections: [
        {
          title: 'General Information',
          children: [
            {
              name: 'id',
              type: 'stringInput',
              title: 'ID',
              rules: 'required|string|between:2,64|regex:/^[a-zA-Z][a-zA-Z0-9_-]+$/',
              desc:
                'This is a required field. This is used for uniquely identifying the authentication provider. ' +
                'It must be between 2 to 64 characters long and must start with an alphabet and may contain alpha numeric ' +
                'characters, underscores, and dashes. No other special symbols are allowed.',
            },
            {
              name: 'title',
              type: 'stringInput',
              title: 'Title',
              rules: 'required|between:3,255',
              desc: 'This is a required field and must be between 3 and 255 characters long.',
            },
          ],
        },
      ],
    },

    impl: {
      // A locator that identifies the authentication provider implementation
      //
      // The implementation may be internal to the code base or could be provided by some external system via APIs (in future)
      // In case of internal implementation, the below locator should start with 'locator:service:<serviceName>/<methodName>' pointing to the
      // service and method for issuing token. The specified method will be invoked with the authentication request body
      // and the authentication provide configuration
      //
      // In case of external implementation provided via APIs, the below locator could be 'locator:external:<url>' pointing to API for issuing token.
      //
      // The tokenIssuerLocator will be used only in cases the APIs are receiving credentials
      // If the authentication is performed outside of the APIs directly, for example, when submitting
      // credentials to Cognito User Pools directly or when using Cognito User Pool federation to some external identity providers
      // (e.g., via SAML) then the JWT token is issued by Cognito User Pool outside of the the application code.
      // The "tokenIssuerLocator" below will not be used in those cases.
      tokenIssuerLocator: 'locator:service:internalAuthenticationProviderService/issueToken',

      // Similar to the tokenIssuerLocator mentioned above but used for token validation instead of issuing token.
      // The token validation locator is used to validate token upon each request.
      // Unlike the tokenIssuerLocator which is only used for authentication being performed via application APIs, the
      // tokenValidatorLocator is used in all cases
      tokenValidatorLocator: 'locator:service:internalAuthenticationProviderService/validateToken',

      // Similar to the tokenIssuerLocator mentioned above but used for token revocation instead of issuing token.
      // The token revocation locator is used to revoke a token upon logout.
      tokenRevokerLocator: 'locator:service:internalAuthenticationProviderService/revokeToken',

      // Similar to above locators. The provisionerLocator identifies an implementation that takes care of provisioning the authentication provider.
      // In case of Internal Authentication Provider this "provisioning" step may be as simple as adding authentication provider configuration in Data Base.
      // In case of other auth providers, this step may be more elaborate (for example, in case of Cognito + SAML, the provisioner has to create Cognito User Pool,
      // configure Cognito client application, configure SAML identity providers in the Cognito User Pool etc.)
      provisionerLocator: 'locator:service:internalAuthenticationProvisionerService/provision',
    },
  },
};
