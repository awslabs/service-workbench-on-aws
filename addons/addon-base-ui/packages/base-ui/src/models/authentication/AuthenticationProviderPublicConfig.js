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
import uuid from 'uuid/v4';
import { getEnv, types } from 'mobx-state-tree';
import { authenticate, config } from '../../helpers/api';
import { storage, isAbsoluteUrl, getQueryParam, removeQueryParams, addQueryParams } from '../../helpers/utils';

import localStorageKeys from '../constants/local-storage-keys';
import { boom } from '../../helpers/errors';
import { websiteUrl } from '../../helpers/settings';

function toAbsoluteUrl(uri) {
  return isAbsoluteUrl(uri) ? uri : `${config.apiPath}/${uri}`;
}
const AUTHN_EXTENSION_POINT = 'authentication';

// TODO: Remove this temp adjustment method. See comments in "absoluteSignInUrl" getter below for more details.
function adjustRedirectUri(uri, redirectType = 'login') {
  // Adjust the name of the query param to update and determine whether to preserve the path
  // based on whether the user is logging in or out
  let redirectParamName = 'redirect_uri';
  let preservePath = true;
  if (redirectType === 'logout') {
    redirectParamName = 'logout_uri';
    preservePath = false;
  }

  // if the current uri contains redirect param and if it is not the same as websiteUrl then adjust it
  // This is required during local development. For other envs, redirectUri and websiteUrl will be same.
  const initialRedirectUri = getQueryParam(uri, [redirectParamName]);

  let adjustedUri = uri;
  if (initialRedirectUri !== websiteUrl) {
    adjustedUri = removeQueryParams(uri, [redirectParamName]);
    adjustedUri = addQueryParams(adjustedUri, {
      [redirectParamName]: preservePath ? window.location : window.location.origin,
    });
  }

  return adjustedUri;
}

const AuthenticationProviderPublicConfig = types
  .model('AuthenticationProviderPublicConfig', {
    id: '',
    title: types.identifier,
    type: '',
    credentialHandlingType: '',
    signInUri: '',
    signOutUri: '',
    enableNativeUserPoolUsers: types.maybeNull(types.boolean),
  })
  .actions(self => ({
    cleanup() {
      // No-op for now
    },

    login: async ({ username, password } = {}) => {
      // save the state verifier code to local storage (this is to protect against CSRF attacks)
      // we need to verify this code after we are redirected back from the IDP
      const nonceState = uuid();
      storage.setItem(localStorageKeys.stateVerifier, nonceState);
      self.signInUri = self.signInUri.replace('TEMP_STATE_VERIFIER', nonceState);

      const pluginRegistry = getEnv(self).pluginRegistry;

      const handleException = err => {
        const code = _.get(err, 'code');
        const isBoom = _.get(err, 'isBoom');
        if (code === 'badRequest') throw boom.badRequest(err, err.message);
        if (isBoom) throw err;
        throw boom.apiError(err, 'Something went wrong while trying to contact the server.');
      };

      try {
        // Notify each authentication plugins of explicit login attempt
        await pluginRegistry.runPlugins(AUTHN_EXTENSION_POINT, 'loginInitiated');

        if (self.credentialHandlingType === 'submit') {
          // if the selectedAuthenticationProvider requires credentials to be submitted
          // then submit the username/password to the specified URL
          const authenticationProviderId = self.id;

          const loginResult = await authenticate(self.absoluteSignInUrl, username, password, authenticationProviderId);

          // If code reached here means the login was successful.
          // (The above line would throw exception in case of failed login - in case of incorrect credentials or any other error)
          // Notify each authentication plugins after explicit login.
          await pluginRegistry.runPlugins(AUTHN_EXTENSION_POINT, 'loginDetected', { explicitLogin: true });

          return loginResult;
        }
        if (self.credentialHandlingType === 'redirect') {
          // if the selectedAuthenticationProvider requires us to redirect to identity provider
          // instead of collecting credentials from user (for example, in case of SAML)
          // just redirect to the specified url.
          // The authentication plugins will be notified of 'loginDetected' in this case after the login process is
          // complete by the "initialization-plugin"
          window.location = self.absoluteSignInUrl;
        }
      } catch (err) {
        handleException(err);
      }
      return undefined;
    },

    logout: async ({ autoLogout = false } = {}) => {
      const pluginRegistry = getEnv(self).pluginRegistry;
      // Notify each authentication plugins of explicit logout attempt.
      // Explicit logout may be explicitly initiated
      // - by user - "autoLogout: false" - (e.g., clicking on logout) OR
      // - by application automatically - "autoLogout: true" - (e.g., app code initiating logout due to certain period
      // of user inactivity
      await pluginRegistry.runPlugins(AUTHN_EXTENSION_POINT, 'logoutInitiated', { autoLogout });

      if (self.signOutUri) {
        // if the selectedAuthenticationProvider requires us to redirect to some logout URL
        // (such as SAML logout url in case of identity federation) just redirect to the specified url.
        // The authentication plugins will be notified of 'logoutDetected' in this case after the logout process is
        // complete by the "initialization-plugin"
        window.location = self.absoluteSignOutUrl;
      } else {
        const cleaner = getEnv(self).cleaner;
        await cleaner.cleanup();
        window.history.pushState('', '', '/');

        // Notify each authentication plugins after explicit logout.
        await pluginRegistry.runPlugins(AUTHN_EXTENSION_POINT, 'logoutDetected', {
          explicitLogout: true,
          autoLogout,
        });
      }
    },
  }))
  .views(self => ({
    get absoluteSignInUrl() {
      // The "signInUri" below contains redirectUrl that comes from server and points back to the actual websiteUrl
      // (even on local machines during local development)
      // TODO: Temp code: Adjust redirectUrl for local development.
      //  This will go away once we switch to the idea of "provider registry". Currently, the provider configs are retrieved
      //  from a central "AuthenticationProviderConfigService" on the server side and the providers do not get a chance to adjust "signInUri"
      //  (or any other config variables) before returning them during local development, once we move to "provider registry" the registry will
      //  pick appropriate auth provider impl and give it a chance to adjust variables or create derived variables

      return adjustRedirectUri(toAbsoluteUrl(self.signInUri));
    },
    get absoluteSignOutUrl() {
      return adjustRedirectUri(toAbsoluteUrl(self.signOutUri), 'logout');
    },
  }));

export default AuthenticationProviderPublicConfig;
