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

const jwtDecode = require('jwt-decode');
const _ = require('lodash');

const Service = require('@aws-ee/base-services-container/lib/service');
const { newInvoker } = require('./authentication-providers/helpers/invoker');

const notAuthenticated = claims => ({ ...claims, authenticated: false });
const authenticated = claims => ({ ...claims, authenticated: true });

class AuthenticationService extends Service {
  constructor() {
    super();
    this.dependency(['authenticationProviderConfigService', 'pluginRegistryService']);
  }

  async init() {
    this.invoke = newInvoker(this.container.find.bind(this.container));
    this.pluginRegistryService = await this.service('pluginRegistryService');
  }

  /**
   * type AuthenticationResult = AuthenticationSuccess | AuthenticationFailed;
   * type AuthenticationSuccess = {
   *   authenticated: true
   *   verifiedToken: Object
   *   uid: string
   *   username: string
   *   authenticationProviderId: string
   *   identityProviderName?: string
   * }
   * type AuthenticationError = {
   *   authenticated: false
   *   error: Error | string
   *   uid?: string
   *   username?: string
   *   authenticationProviderId?: string
   *   identityProviderName?: string
   * }
   *
   * @returns AuthenticationResult
   */
  // TODO return username even if authentication fails.
  async authenticateMain(token) {
    const [authenticationProviderConfigService] = await this.service(['authenticationProviderConfigService']);
    if (!token) {
      return notAuthenticated({ error: 'empty token' });
    }
    let claims;
    try {
      claims = jwtDecode(token);
    } catch (error) {
      return notAuthenticated({
        error: `jwt decode error: ${error.toString()}`,
      });
    }
    const providerId = claims.iss;
    const providerConfig = await authenticationProviderConfigService.getAuthenticationProviderConfig(providerId);
    if (!providerConfig) {
      return notAuthenticated({
        uid: claims.sub,
        username: claims.username,
        authenticationProviderId: claims.iss,
        error: `unknown provider id: '${providerId}'`,
      });
    }
    let tokenValidatorLocator;
    try {
      tokenValidatorLocator = providerConfig.config.type.config.impl.tokenValidatorLocator;
    } catch (error) {
      // exceptional circumstance, throw an actual error
      throw new Error(`malformed provider config for provider id '${providerId}'`);
    }
    try {
      const { verifiedToken, uid, username, identityProviderName } = await this.invoke(
        tokenValidatorLocator,
        { token, issuer: claims.iss },
        providerConfig,
      );
      return authenticated({
        token,
        verifiedToken,
        uid,
        username,
        identityProviderName,
        authenticationProviderId: providerId,
      });
    } catch (error) {
      return notAuthenticated({
        uid: claims.sub,
        username: claims.username,
        authenticationProviderId: claims.iss,
        error,
      });
    }
  }

  async authenticate(token) {
    const originalAuthResult = await this.authenticateMain(token);
    // Give all plugins a chance to customize the authentication result
    return this.checkWithPlugins(token, originalAuthResult);
  }

  async checkWithPlugins(token, authResult) {
    // Give all plugins a chance to customize the authentication result
    // This gives plugins registered to 'authentication' a chance to participate in the token
    // validation/authentication process
    const result = await this.pluginRegistryService.visitPlugins('authentication', 'authenticate', {
      payload: { token, container: this.container, authResult },
    });
    const effectiveAuthResult = _.get(result, 'authResult', authResult);
    return effectiveAuthResult;
  }
}

module.exports = AuthenticationService;
