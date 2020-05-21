const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

class UserAttributesMapperService extends Service {
  mapAttributes(decodedToken) {
    const { username, usernameInIdp } = this.getUsername(decodedToken);
    const identityProviderName = this.getIdpName(decodedToken);
    const isSamlAuthenticatedUser = this.isSamlAuthenticatedUser(decodedToken);
    const firstName = this.getFirstName(decodedToken);
    const lastName = this.getLastName(decodedToken);
    const email = this.getEmail(decodedToken);

    return {
      username,
      usernameInIdp,
      identityProviderName,
      isSamlAuthenticatedUser,

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
    return decodedToken.given_name;
  }

  isSamlAuthenticatedUser(decodedToken) {
    const isSamlAuthenticatedUser =
      decodedToken.identities &&
      decodedToken.identities[0] &&
      _.toUpper(decodedToken.identities[0].providerType) === 'SAML';
    return isSamlAuthenticatedUser;
  }

  getIdpName(decodedToken) {
    let identityProviderName = '';
    if (decodedToken.identities && decodedToken.identities[0] && decodedToken.identities[0].providerName) {
      identityProviderName = decodedToken.identities[0].providerName;
    }
    return identityProviderName;
  }

  getUsername(decodedToken) {
    let username = decodedToken['cognito:username'];
    let usernameInIdp = username;
    if (username.indexOf('\\') > -1) {
      // the cognito username may contain backslash (in case the user is authenticated via some other identity provider
      // via federation - such as SAML replace backslash with underscore in such case to satisfy various naming
      // constraints in our code base this is because we use the username for automatically naming various dependent
      // resources (such as IAM roles, policies, unix user groups etc) The backslash would not work in most of those
      // cases
      // Grab raw username on the IDP side. This is needed in certain situations
      // For example, when creating user home directories on jupyter for LDAP users, the directory name needs to match
      // username in IDP (i.e., AD or LDAP)
      usernameInIdp = _.split(username, '\\')[1];
      username = username.replace('\\', '_');
    }
    return { username, usernameInIdp };
  }
}

module.exports = UserAttributesMapperService;
