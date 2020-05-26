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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const { getCognitoTokenVerifier } = require('./cognito-token-verifier');

class ProviderService extends Service {
  constructor() {
    super();
    this.dependency(['userService', 'userAttributesMapperService', 'tokenRevocationService']);
    this.cognitoTokenVerifiersCache = {}; // Cache object containing token verifier objects. Each token verifier is keyed by the userPoolUri
  }

  // eslint-disable-next-line no-unused-vars
  async validateToken({ token, issuer }, providerConfig) {
    if (_.isEmpty(token)) {
      throw this.boom.forbidden('no jwt token was provided', true);
    }
    // -- Check if this token is revoked (may be due to an earlier logout)
    const tokenRevocationService = await this.service('tokenRevocationService');
    const isRevoked = await tokenRevocationService.isRevoked({ token });
    if (isRevoked) {
      throw this.boom.invalidToken('The token is revoked', true);
    }

    // In case of cognito, the issuer is the cognito userPoolUri
    const userPoolUri = issuer;
    let cognitoTokenVerifier = this.cognitoTokenVerifiersCache[userPoolUri];
    if (!cognitoTokenVerifier) {
      // No cognitoTokenVerifier in the cache so create a new one
      cognitoTokenVerifier = await getCognitoTokenVerifier(userPoolUri, this.log);
      // Add newly created cognitoTokenVerifier to the cache
      this.cognitoTokenVerifiersCache[userPoolUri] = cognitoTokenVerifier;
    }
    // User the cognitoTokenVerifier to validate cognito token
    const verifiedToken = await cognitoTokenVerifier.verify(token);
    const { username, identityProviderName } = await this.saveUser(verifiedToken, providerConfig.config.id);
    return { verifiedToken, username, identityProviderName };
  }

  async saveUser(decodedToken, authenticationProviderId) {
    const userAttributesMapperService = await this.service('userAttributesMapperService');
    // Ask user attributes mapper service to read information from the decoded token and map them to user attributes
    const userAttributes = await userAttributesMapperService.mapAttributes(decodedToken);
    if (userAttributes.isSamlAuthenticatedUser) {
      // If this user is authenticated via SAML then we need to add it to our user table if it doesn't exist already
      const userService = await this.service('userService');

      const user = await userService.findUser({
        username: userAttributes.username,
        authenticationProviderId,
        identityProviderName: userAttributes.identityProviderName,
      });
      if (user) {
        await this.updateUser(authenticationProviderId, userAttributes, user);
      } else {
        await this.createUser(authenticationProviderId, userAttributes);
      }
    }
    return userAttributes;
  }

  /**
   * Creates a user in the system based on the user attributes provided by the SAML Identity Provider (IdP)
   * @param authenticationProviderId ID of the authentication provider
   * @param userAttributes An object containing attributes mapped from SAML IdP
   * @returns {Promise<void>}
   */
  async createUser(authenticationProviderId, userAttributes) {
    const userService = await this.service('userService');
    try {
      await userService.createUser(getSystemRequestContext(), {
        authenticationProviderId,
        ...userAttributes,
      });
    } catch (err) {
      this.log.error(err);
      throw this.boom.internalError('error creating user');
    }
  }

  /**
   * Updates user in the system based on the user attributes provided by the SAML Identity Provider (IdP).
   * This base implementation updates only those user attributes in the system which are missing but are available in
   * the SAML user attributes. Subclasses can override this method to provide different implementation (for example,
   * update all user attributes in the system if they are updated in SAML IdP etc)
   *
   * @param authenticationProviderId ID of the authentication provider
   * @param userAttributes An object containing attributes mapped from SAML IdP
   * @param existingUser The existing user in the system
   *
   * @returns {Promise<void>}
   */
  async updateUser(authenticationProviderId, userAttributes, existingUser) {
    // Find all attributes present in the userAttributes but missing in existingUser
    const missingAttribs = {};
    const keys = _.keys(userAttributes);
    if (!_.isEmpty(keys)) {
      _.forEach(keys, key => {
        const value = userAttributes[key];
        const existingValue = existingUser[key];

        // check if the attribute is missing in the existingUser object but present in
        // userAttributes (i.e., the user attributes mapped from SAML assertions)
        if (_.isNil(existingValue)) {
          missingAttribs[key] = value;
        }
      });
    }

    // If there are any attributes that are present in the userAttributes but missing in existingUser
    // then update the user in the system to set the missing attributes
    if (!_.isEmpty(missingAttribs)) {
      const userService = await this.service('userService');
      const { username, identityProviderName, rev } = existingUser;
      try {
        await userService.updateUser(getSystemRequestContext(), {
          username,
          authenticationProviderId,
          identityProviderName,
          rev,
          ...missingAttribs,
        });
      } catch (err) {
        this.log.error(err);
        throw this.boom.internalError('error updating user');
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  async revokeToken(requestContext, { token }, providerConfig) {
    const tokenRevocationService = await this.service('tokenRevocationService');
    await tokenRevocationService.revoke(requestContext, { token });
  }
}

module.exports = ProviderService;
