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
    projectId: types.array(types.string, []),
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
