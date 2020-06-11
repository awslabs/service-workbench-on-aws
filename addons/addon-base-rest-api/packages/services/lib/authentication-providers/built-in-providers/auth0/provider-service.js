/*jshint esversion: 9 */
const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const {
  getAuth0TokenVerifier
} = require('./auth0-token-verifier');
const {
  getSystemRequestContext
} = require('@aws-ee/base-services/lib/helpers/system-context');

class ProviderService extends Service {
  constructor() {
    super();
    this.dependency(['userService', 'auth0Service']);
    this.auth0TokenVerifiersCache = {}; // Cache object containing token verifier objects. Each token verifier is keyed by the userPoolUri
  }

  // eslint-disable-next-line no-unused-vars
  async validateToken({
    token,
    issuer
  }, providerConfig) {
    if (_.isEmpty(token)) {
      throw this.boom.forbidden('no jwt token was provided', true);
    }
    // In case of cognito, the issuer is the cognito userPoolUri
    const userPoolUri = issuer;
    let auth0TokenVerifier = this.auth0TokenVerifiersCache[userPoolUri];
    if (!auth0TokenVerifier) {
      // No cognitoTokenVerifier in the cache so create a new one
      auth0TokenVerifier = await getAuth0TokenVerifier(userPoolUri, this.log);
      // Add newly created cognitoTokenVerifier to the cache
      this.auth0TokenVerifiersCache[userPoolUri] = auth0TokenVerifier;
    }
    // User the auth0TokenVerifier to validate cognito token
    const verifiedToken = await auth0TokenVerifier.verify(token);
    const auth0Service = await this.service('auth0Service');
    const accessToken = await auth0Service.getAuth0Token();
    const IdProviders = await auth0Service.getIdproviders(accessToken, verifiedToken.sub);
    const {
      username,
      identityProviderName
    } = await this.createUserIfDoesntExist(
      verifiedToken,
      providerConfig.config.id,
      IdProviders,
    );
    return {
      verifiedToken,
      username,
      identityProviderName,
    };
  }

  async createUserIfDoesntExist(decodedToken, authenticationProviderId, IdProviders) {
    const email = _.isEmpty(decodedToken.email) ? this.makeEmail() : decodedToken.email;
    let username = email;
    let identityProviderName = '';

    // Auth0 authentication is configured by customer, in DBMI case, the authentication will be set to Open ID Connection

    // If this user is authenticated via auth0 then we need to add it to our user table if it doesn't exist already
    const userService = await this.service('userService');

    // try find user in dynamo user table
    let foundUser = false;
    for (let i = 0; i < IdProviders.length; i++) {
      const idp = IdProviders[i];
      identityProviderName = idp.provider;
      const user = await userService.findUser({
        username,
        authenticationProviderId,
        identityProviderName,
      });
      if (user) {
        foundUser = true;
        break;
      }
    }

    if (!foundUser) {
      // Save user if it does not exist already
      // TODO: What if the user's attributes (such as firstName or lastName) changed in IdP? Should we update our
      // user here?

      // assign default idp for user here
      identityProviderName = IdProviders[0].provider;

      try {
        await userService.createUser(getSystemRequestContext(), {
          username,
          authenticationProviderId,
          identityProviderName,
          firstName: decodedToken.nickname,
          lastName: decodedToken.nickname,
          email,
          isAdmin: false,
          userRole: 'guest',
          status: 'inactive',
          rev: 0,
          dbmiProjectId: [],
          isExternalUser: true,
          applyReason: 'N/A',
        });
      } catch (err) {
        this.log.error(err);
        throw this.boom.internalError('error creating user');
      }
    }

    return {
      username,
      identityProviderName
    };
  }

  makeEmail() {
    var strValues = 'abcdefghijklmnopqrstuvwxyz1234567890';
    var strEmail = '';
    var strTmp;
    for (var i = 0; i < 15; i++) {
      strTmp = strValues.charAt(Math.round(strValues.length * Math.random()));
      strEmail = strEmail + strTmp;
    }
    strTmp = '';
    strEmail = strEmail + '@amazon.com';
    return strEmail;
  }
}

module.exports = ProviderService;