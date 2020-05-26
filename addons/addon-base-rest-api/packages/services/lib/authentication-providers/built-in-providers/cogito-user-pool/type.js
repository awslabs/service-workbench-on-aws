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

const { inputManifestForCreate } = require('./create-cognito-user-pool-input-manifest');
const { inputManifestForUpdate } = require('./update-cognito-user-pool-input-manifest');
const inputSchema = require('./create-cognito-user-pool-schema');

module.exports = {
  type: 'cognito_user_pool',
  title: 'Cognito User Pool',
  description: 'Authentication provider for Amazon Cognito User Pool',
  config: {
    // credentialHandlingType indicating credential handling for the authentication provider
    // Possible values:
    // 'submit' -- The credentials should be submitted to the URL provided by the authentication provider
    // 'redirect' -- The credentials should be NOT be collected and the user should be redirected directly to the
    // URL provided by the authentication provider. For example, in case of SAML auth, the username/password
    // should not be collected by the service provider but the user should be redirected to the identity provider
    credentialHandlingType: 'redirect',

    // "inputSchema": JSON schema representing inputs required from user when configuring an authentication provider of this type.
    inputSchema,

    // The "inputManifest*" will be used on the UI to ask configuration inputs from the user when registering new
    // authentication provider
    inputManifestForCreate,
    inputManifestForUpdate,

    impl: {
      // In case of Cognito User Pools, the ID token is issued by the User Pool
      // the tokenIssuerLocator is not applicable in this case
      // tokenIssuerLocator: '',

      // Similar to the tokenIssuerLocator mentioned above but used for token validation instead of issuing token.
      // The token validation locator is used to validate token upon each request.
      // Unlike the tokenIssuerLocator which is only used for authentication being performed via application APIs, the
      // tokenValidatorLocator is used in all cases
      tokenValidatorLocator: 'locator:service:cognitoUserPoolAuthenticationProviderService/validateToken',

      // Similar to the tokenIssuerLocator mentioned above but used for token revocation instead of issuing token.
      // The token revocation locator is used to revoke a token upon logout.
      tokenRevokerLocator: 'locator:service:cognitoUserPoolAuthenticationProviderService/revokeToken',

      // Similar to above locators. The provisionerLocator identifies an implementation that takes care of provisioning the authentication provider.
      // In case of Internal Authentication Provider this "provisioning" step may be as simple as adding authentication provider configuration in Data Base.
      // In case of other auth providers, this step may be more elaborate (for example, in case of Cognito + SAML, the provisioner has to create Cognito User Pool,
      // configure cognito client application, configure SAML identity providers in the Cognito User Pool etc.
      provisionerLocator: 'locator:service:cognitoUserPoolAuthenticationProvisionerService/provision',
    },
  },
};
