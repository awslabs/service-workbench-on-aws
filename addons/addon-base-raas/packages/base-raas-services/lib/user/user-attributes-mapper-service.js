const BaseAttribMapperService = require('@aws-ee/base-api-services/lib/authentication-providers/built-in-providers/cogito-user-pool/user-attributes-mapper-service');

class UserAttributesMapperService extends BaseAttribMapperService {
  mapAttributes(decodedToken) {
    const userAttributes = super.mapAttributes(decodedToken);
    // For RaaS solution, the user's email address should be used as his/her username
    // so set username to be email address
    userAttributes.username = userAttributes.email;

    return userAttributes;
  }
}

module.exports = UserAttributesMapperService;
