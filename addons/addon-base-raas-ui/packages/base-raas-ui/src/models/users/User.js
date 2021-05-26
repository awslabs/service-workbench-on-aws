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
import { storage, removeNulls } from '@aws-ee/base-ui/dist/helpers/utils';
import { aesGcmEncrypt, aesGcmDecrypt } from '../../helpers/crypto';
import localStorageKeys from '../constants/local-storage-keys';

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
    userRole: '',
    projectId: types.array(types.string, []), // TODO this property should be named projectIds
    isExternalUser: types.optional(types.boolean, false), // TODO we need to consider have this a derived property
    encryptedCreds: types.maybeNull(types.string),
    applyReason: '',
  })
  .actions(self => ({
    runInAction(fn) {
      return fn();
    },
    async setEncryptedCreds(unencryptedCreds, pin) {
      unencryptedCreds.region = unencryptedCreds.region || 'us-east-1';
      const encryptedCreds = await aesGcmEncrypt(JSON.stringify(unencryptedCreds), pin);
      // TODO Should we store the pin in the session?
      storage.setItem(localStorageKeys.pinToken, pin);
      self.runInAction(() => {
        self.encryptedCreds = encryptedCreds;
      });
    },
    async clearEncryptedCreds() {
      self.runInAction(() => {
        self.encryptedCreds = undefined;
      });
    },
    setUser(rawUser) {
      removeNulls(rawUser);
      self.firstName = rawUser.firstName || self.firstName || '';
      self.lastName = rawUser.lastName || self.lastName || '';
      self.isAdmin = rawUser.isAdmin || self.isAdmin;
      self.isExternalUser = rawUser.isExternalUser || self.isExternalUser;
      self.username = rawUser.username || self.username;
      self.ns = rawUser.ns || self.ns;
      self.email = rawUser.email || self.email;
      self.authenticationProviderId = rawUser.authenticationProviderId || self.authenticationProviderId;
      self.identityProviderName = rawUser.identityProviderName || self.identityProviderName;
      self.status = rawUser.status || self.status || 'active';
      self.createdBy = rawUser.createdBy || self.createdBy;
      self.rev = rawUser.rev || self.rev || 0;
      self.userRole = rawUser.userRole || self.userRole;
      self.projectId = rawUser.projectId || self.projectId || [];
      self.encryptedCreds = rawUser.encryptedCreds || self.encryptedCreds;
      self.applyReason = rawUser.applyReason || self.applyReason || '';
      // we don't update the other fields because they are being populated by a separate store
    },
  }))
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

    get isInternalAuthUser() {
      return _.toLower(self.authenticationProviderId) === 'internal';
    },

    get isActive() {
      return _.toLower(self.status) === 'active';
    },

    get isInternalGuest() {
      return self.userRole === 'internal-guest';
    },

    get isExternalGuest() {
      return self.userRole === 'guest';
    },

    get isInternalResearcher() {
      return self.userRole === 'researcher';
    },

    get isExternalResearcher() {
      return self.userRole === 'external-researcher';
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

    get hasProjects() {
      return !_.isEmpty(self.projectId);
    },

    get hasCredentials() {
      return self.isExternalResearcher && !_.isEmpty(self.encryptedCreds) && self.encryptedCreds !== 'N/A';
    },

    // TODO - this should not be a view, it should be moved to the actions section
    //      - a better approach is to do unencryptedCreds as a view but then
    //      have the call to store the pin in a separate method that is in the action
    async unencryptedCreds(pin) {
      try {
        const creds = JSON.parse(await aesGcmDecrypt(self.encryptedCreds, pin));
        // TODO Should we store the pin in the session?
        storage.setItem(localStorageKeys.pinToken, pin);
        return creds;
      } catch (e) {
        throw new Error('Invalid PIN. Please try again');
      }
    },

    // A map of high level actions that the user is allowed to perform.
    // Example:  { 'canCreateStudy': true/false, 'canCreateWorkspace': true/false }
    //
    // Note: actions that require a resource before the permission is determined, are NOT captured in this capability matrix.
    get capabilities() {
      const active = self.isActive;
      const external = self.isExternalUser; // Either external guest or external user
      const externalGuest = self.isExternalGuest;
      const internalGuest = self.isInternalGuest;

      const canCreateStudy = active && !external && !internalGuest;
      const canCreateWorkspace = active && !externalGuest && !internalGuest;
      const canSelectStudy = active && !externalGuest && !internalGuest;
      const canViewDashboard = active && !external && !internalGuest;

      return {
        canCreateStudy,
        canCreateWorkspace,
        canSelectStudy,
        canViewDashboard,
      };
    },
  }));

function getPrincipalObjFromPrincipalStr(principalStr) {
  return JSON.parse(principalStr);
}

function getPrincipalStrFromPrincipalObj({ username, ns }) {
  return JSON.stringify({ username, ns });
}

export { User, getPrincipalObjFromPrincipalStr, getPrincipalStrFromPrincipalObj };
