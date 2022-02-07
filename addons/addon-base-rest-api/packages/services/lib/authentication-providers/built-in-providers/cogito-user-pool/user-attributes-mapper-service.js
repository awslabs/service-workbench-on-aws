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

class UserAttributesMapperService extends Service {
  mapAttributes(decodedToken) {
    const { username, usernameInIdp } = this.getUsername(decodedToken);
    const identityProviderName = this.getIdpName(decodedToken);
    const isSamlAuthenticatedUser = this.isSamlAuthenticatedUser(decodedToken);
    const isNativePoolUser = this.isNativePoolUser(decodedToken);
    const firstName = this.getFirstName(decodedToken);
    const lastName = this.getLastName(decodedToken);
    const email = this.getEmail(decodedToken);

    return {
      username,
      usernameInIdp,
      identityProviderName,
      isSamlAuthenticatedUser,
      isNativePoolUser,

      firstName,
      lastName,
      email,
    };
  }

  getEmail(decodedToken) {
    return decodedToken.email;
  }

  getLastName(decodedToken) {
    return decodedToken.family_name;
  }

  getFirstName(decodedToken) {
    return decodedToken.given_name || decodedToken.name;
  }

  isSamlAuthenticatedUser(decodedToken) {
    const isSamlAuthenticatedUser =
      decodedToken.identities &&
      decodedToken.identities[0] &&
      _.toUpper(decodedToken.identities[0].providerType) === 'SAML';
    return !_.isUndefined(isSamlAuthenticatedUser) && isSamlAuthenticatedUser;
  }

  isNativePoolUser(decodedToken) {
    const issuer = decodedToken.iss;
    return !this.isSamlAuthenticatedUser(decodedToken) && _.startsWith(issuer, 'https://cognito-idp');
  }

  getIdpName(decodedToken) {
    let identityProviderName = '';
    if (decodedToken.identities && decodedToken.identities[0] && decodedToken.identities[0].providerName) {
      identityProviderName = decodedToken.identities[0].providerName;
    }
    if (identityProviderName === '' && this.isNativePoolUser(decodedToken))
      identityProviderName = 'Cognito Native Pool';
    return identityProviderName;
  }

  getUsername(decodedToken) {
    /*
    An example decodedToken contains the following user specific attributes:
    {
      "cognito:username": "AWS-SSO_some_user_id@example.com",
      "identities": [
        {
          "userId": "some_user_id@example.com",
          "providerName": "AWS-SSO",
          "providerType": "SAML",
          "issuer": "https://portal.sso.us-west-2.amazonaws.com/saml/assertion/SOMEISSUERID",
          "primary": "true",
          "dateCreated": "1596771547011"
        }]
      ...
      ...
    }
    We will get the userId from identities structure if present since it doesn't have the custom providerName
    prepended
     */
    let username = '';
    let usernameInIdp = '';
    if (
      decodedToken.identities &&
      decodedToken.identities.length === 1 &&
      decodedToken.identities[0] &&
      decodedToken.identities[0].providerName &&
      decodedToken.identities[0].userId
    ) {
      username = decodedToken.identities[0].userId;
      usernameInIdp = username;
    } else {
      username = decodedToken['cognito:username'];
      usernameInIdp = username;
    }

    // The username may contain \\ or | (in case the user is authenticated via some other identity provider
    // via federation - such as SAML replace backslash with underscore in such case to satisfy various naming
    // constraints in our code base this is because we use the username for automatically naming various dependent
    // resources (such as IAM roles, policies, unix user groups etc) The backslash would not work in most of those
    // cases
    // Grab raw username on the IDP side. This is needed in certain situations
    // For example, when creating user home directories on jupyter for LDAP users, the directory name needs to match
    // username in IDP (i.e., AD or LDAP)

    // Examples of how username may appear:
    // User without federation: johndoe@example.com
    // User with Auth0 federation: auth0|5ef37c962da
    // User with ADFS federation: ADFS\\123abc
    // User with AWS SSO: johndoe@example.com

    if (username.includes('\\')) {
      usernameInIdp = _.split(username, '\\')[1];
      username = username.replace('\\', '_');
    }

    if (username.includes('|')) {
      usernameInIdp = _.split(username, '|')[1];
      username = username.replace('|', '_');
    }

    return { username, usernameInIdp };
  }
}

module.exports = UserAttributesMapperService;
