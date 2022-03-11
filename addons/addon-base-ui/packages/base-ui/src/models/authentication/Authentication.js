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

import _ from 'lodash';
import { getEnv, types } from 'mobx-state-tree';

import jwtDecode from 'jwt-decode';
import { storage, getFragmentParam, removeFragmentParams } from '../../helpers/utils';
import { getIdToken, setIdToken } from '../../helpers/api';

import localStorageKeys from '../constants/local-storage-keys';
import { boom } from '../../helpers/errors';

function removeTokensFromUrl() {
  const newUrl = removeFragmentParams(document.location, ['code', 'id_token', 'state']);
  window.history.replaceState({}, document.title, newUrl);
}

// ==================================================================
// Login model
// ==================================================================
const Authentication = types
  .model('Authentication', {
    processing: false,
    selectedAuthenticationProviderId: '',
  })
  .actions(self => ({
    runInAction(fn) {
      return fn();
    },

    // this method is called by the Cleaner
    cleanup() {
      if (self.selectedAuthenticationProvider) {
        // give selected authentication provider a chance to do its own cleanup
        self.selectedAuthenticationProvider.cleanup();
      }
      self.clearTokens();
    },

    clearTokens() {
      _.forEach(localStorageKeys, keyValue => storage.removeItem(keyValue));
    },

    setSelectedAuthenticationProviderId(authenticationProviderId) {
      self.selectedAuthenticationProviderId = authenticationProviderId;
    },

    async getIdToken() {
      // The id token would be in URL in case of SAML redirection.
      // The name of the token param is "id_token" in that case (instead of "appIdToken"), if the token is
      // issued by Cognito.
      // Also the id_token is returned via URL fragment i.e, with # instead of query param something like
      // https://web.site.url/#id_token=blabla instead of
      // https://web.site.url?idToken=blabla
      // TODO: Make the retrieval of id token from query string param or fragment param (or any other mechanism)
      // dynamic based on the authentication provider. Without that, the following code will only work for
      // any auth providers that set id token either in local storage as "appIdToken" or deliver to us
      // via URL fragment parameter as "id_token".
      // This code will NOT work for auth providers issuing id token and delivering via any other mechanism.

      const authCode = getFragmentParam(document.location, 'code');
      const state = getFragmentParam(document.location, 'state');

      const stateVerifier = storage.getItem(localStorageKeys.stateVerifier);

      // these are a one-time codes so we delete it as it is no longer useful after this
      storage.removeItem(localStorageKeys.stateVerifier);

      console.log(state);
      console.log(stateVerifier);

      // If either is defined, both values must be equal
      if (!(_.isNil(state) && _.isNil(stateVerifier)) && state !== stateVerifier) {
        throw boom.badRequest(`The provided state does not match the client's state. Stopping login attempt.`);
      }

      // Use this code to send to Cognito to get auth token
      // Then store auth token as appIdToken on client
      let newIdToken;
      if (authCode) {
        const mainUrl = document.location.href.split('?code')[0];
        newIdToken = await getIdToken({
          code: authCode,
          mainUrl,
        });

        // we remove the code from the url for a good security measure
        removeTokensFromUrl();
      }

      const idTokenFromLocal = storage.getItem(localStorageKeys.appIdToken);

      const idToken = _.isUndefined(newIdToken) ? idTokenFromLocal : newIdToken.token;
      return idToken;
    },

    async getIdTokenInfo() {
      const idToken = await self.getIdToken();

      let tokenStatus = 'notFound';
      let decodedIdToken;
      if (idToken) {
        try {
          decodedIdToken = jwtDecode(idToken);
          // Check if the token is expired
          // decodedIdToken.exp is epoch time in SECONDS
          // ( - See "exp" claim JWT RFC - https://tools.ietf.org/html/rfc7519#section-4.1.4 for details
          //   - the claim is in "NumericDate" format.
          //   - NumericDate is Epoch in Seconds - https://ldapwiki.com/wiki/NumericDate )
          //
          // Date.now() returns epoch time in MILLISECONDS
          const expiresAt = _.get(decodedIdToken, 'exp', 0) * 1000;
          if (Date.now() >= expiresAt) {
            tokenStatus = 'expired';
          } else {
            tokenStatus = 'notExpired';
          }
        } catch (e) {
          // the token may not be a well-formed JWT toekn in case of any error
          // decoding it
          tokenStatus = 'corrupted';
        }
      }
      return {
        idToken,
        decodedIdToken,
        status: tokenStatus,
      };
    },

    async saveIdToken(idToken) {
      storage.setItem(localStorageKeys.appIdToken, idToken);
      const decodedIdToken = idToken && jwtDecode(idToken);
      setIdToken(idToken, decodedIdToken);
    },

    async login({ username, password }) {
      if (self.shouldCollectUserNamePassword) {
        const result = await self.selectedAuthenticationProvider.login({
          username,
          password,
          authenticationProviderId: self.selectedAuthenticationProviderId,
        });
        const { idToken } = result || {};
        if (_.isEmpty(idToken)) {
          throw boom.incorrectImplementation(
            `There is a problem with the implementation of the server side code. The id token is not returned.`,
          );
        }

        await self.saveIdToken(idToken);

        const appRunner = getEnv(self).appRunner;
        await appRunner.run();
      } else {
        // If we do no need to collect credentials from the user then just call login method of the selected authentication provider without any arguments
        // The selected auth provider will then take care of rest of the login flow (such as redirecting to other identity provider etc)
        await self.selectedAuthenticationProvider.login();
      }
    },
    async logout({ autoLogout = false } = {}) {
      self.cleanup();
      return self.selectedAuthenticationProvider.logout({ autoLogout });
    },
  }))
  .views(self => ({
    get isCognitoUserPool() {
      return self.selectedAuthenticationProvider.type === 'cognito_user_pool';
    },
    get selectedAuthenticationProvider() {
      const authenticationProviderPublicConfigsStore = getEnv(self).authenticationProviderPublicConfigsStore;
      return authenticationProviderPublicConfigsStore.toAuthenticationProviderFromId(
        self.selectedAuthenticationProviderId,
      );
    },

    get shouldCollectUserNamePassword() {
      const selectedAuthenticationProvider = self.selectedAuthenticationProvider;
      return selectedAuthenticationProvider && selectedAuthenticationProvider.credentialHandlingType === 'submit';
    },
  }));

function registerContextItems(appContext) {
  appContext.authentication = Authentication.create({}, appContext);
}

export { Authentication, registerContextItems };
