import { types } from 'mobx-state-tree';
import _ from 'lodash';

const User = types
  .model('User', {
    firstName: '',
    lastName: '',
    isAdmin: types.optional(types.boolean, false),
    username: '',
    ns: '',
    email: '',
    userType: '',
    authenticationProviderId: '', // Id of the authentication provider this user is authenticated against (such as internal, cognito auth provider id etc)
    identityProviderName: '', // Name of the identity provider this user belongs to (such as Identity Provider Id in cognito user pool in case of Federation etc)
    status: 'active',
    rev: 0,
  })
  .views(self => ({
    get displayName() {
      return `${self.firstName} ${self.lastName}`;
    },

    get longDisplayName() {
      if (self.unknown) {
        return `${self.username}??`;
      }
      const fullName = `${self.firstName} ${self.lastName}`;
      if (self.email) {
        return `${fullName} (${self.email})`;
      }
      return fullName;
    },

    get unknown() {
      return !self.firstName && !self.lastName;
    },

    get isRootUser() {
      return _.toLower(self.userType) === 'root';
    },

    get isActive() {
      return _.toLower(self.status) === 'active';
    },

    get isSystem() {
      const identifier = self.identifier;
      return identifier.username === '_system_';
    },

    isSame({ username, ns }) {
      return self.username === username && self.ns === ns;
    },

    get id() {
      return self.identifierStr;
    },

    get identifier() {
      return { username: self.username, ns: self.ns };
    },

    get identifierStr() {
      return JSON.stringify(self.identifier);
    },
  }));

function getIdentifierObjFromId(identifierStr) {
  return JSON.parse(identifierStr);
}

function getIdFromObj({ username, ns }) {
  return JSON.stringify({ username, ns });
}

export { User, getIdentifierObjFromId, getIdFromObj };
