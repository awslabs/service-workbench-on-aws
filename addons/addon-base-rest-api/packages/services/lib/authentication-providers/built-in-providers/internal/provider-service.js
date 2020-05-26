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

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const authProviderConstants = require('../../constants').authenticationProviders;

class ProviderService extends Service {
  constructor() {
    super();
    this.dependency(['dbAuthenticationService', 'jwtService', 'tokenRevocationService']);
  }

  async init() {
    await super.init();
  }

  // eslint-disable-next-line no-unused-vars
  async issueToken({ username, password }, providerConfig) {
    const [dbAuthenticationService, jwtService] = await this.service(['dbAuthenticationService', 'jwtService']);

    await dbAuthenticationService.authenticate({
      username,
      password,
    });
    const idToken = await jwtService.sign({
      sub: username,

      // The "iss" (i.e., the issuer) below is used for selecting appropriate authentication provider
      // for validating JWT tokens on subsequent requests.
      // See "issuer" claim in JWT RFC - https://tools.ietf.org/html/rfc7519#section-4.1 for
      // information about this claim
      iss: authProviderConstants.internalAuthProviderId,
    });
    return idToken;
  }

  // eslint-disable-next-line no-unused-vars
  async validateToken({ token, issuer }, providerConfig) {
    if (_.isEmpty(token)) {
      throw this.boom.forbidden('no jwt token was provided', true);
    }
    const jwtService = await this.service('jwtService');
    const verifiedToken = await jwtService.verify(token);
    const { sub: username } = verifiedToken;

    if (_.isEmpty(username)) {
      throw this.boom.invalidToken('No "sub" is provided in the token', true);
    }

    // -- Check if this token is revoked (may be due to an earlier logout)
    const tokenRevocationService = await this.service('tokenRevocationService');
    const isRevoked = await tokenRevocationService.isRevoked({ token });
    if (isRevoked) {
      throw this.boom.invalidToken('The token is revoked', true);
    }

    return { verifiedToken, username };
  }

  // eslint-disable-next-line no-unused-vars
  async revokeToken(requestContext, { token }, providerConfig) {
    const tokenRevocationService = await this.service('tokenRevocationService');
    await tokenRevocationService.revoke(requestContext, { token });
  }
}

module.exports = ProviderService;
