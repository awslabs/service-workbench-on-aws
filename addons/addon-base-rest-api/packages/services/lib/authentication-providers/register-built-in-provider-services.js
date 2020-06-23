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


const InternalAuthenticationProviderService = require('./built-in-providers/internal/provider-service');
const CognitoUserPoolAuthenticationProviderService = require('./built-in-providers/cogito-user-pool/provider-service');
const Auth0AuthenticationProviderService = require('./built-in-providers/auth0/provider-service');
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
  // --- AUTH0 AUTHENTICATION PROVIDER RELATED --- //
  // auth0 - provider
  container.register('auth0AuthenticationProviderService', new Auth0AuthenticationProviderService());
}

module.exports = registerBuiltInAuthProviders;