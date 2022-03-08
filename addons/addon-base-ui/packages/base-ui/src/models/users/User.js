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
    uid: '',
    firstName: types.maybeNull(types.optional(types.string, '')),
    lastName: types.maybeNull(types.optional(types.string, '')),
    isAdmin: types.optional(types.boolean, false),
    username: '',
    ns: types.maybeNull(types.optional(types.string, '')),
    email: '',
    userType: '',
    authenticationProviderId: '', // Id of the authentication provider this user is authenticated against (such as internal, cognito auth provider id etc)
    identityProviderName: types.maybeNull(types.optional(types.string, '')), // Name of the identity provider this user belongs to (such as Identity Provider Id in cognito user pool in case of Federation etc)
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

    get isActive() {
      return _.toLower(self.status) === 'active';
    },

    get isSystem() {
      return self.id === '_system_';
    },

    isSame(uid) {
      return self.uid === uid;
    },

    isSamePrincipal({ username, ns }) {
      return self.username === username && self.ns === ns;
    },

    get id() {
      return self.uid;
    },

    get principal() {
      return { username: self.username, ns: self.ns };
    },

    get principalStr() {
      return JSON.stringify(self.principal);
    },
  }));

function getPrincipalObjFromPrincipalStr(principalStr) {
  return JSON.parse(principalStr);
}

function getPrincipalStrFromPrincipalObj({ username, ns }) {
  return JSON.stringify({ username, ns });
}
export { User, getPrincipalObjFromPrincipalStr, getPrincipalStrFromPrincipalObj };
