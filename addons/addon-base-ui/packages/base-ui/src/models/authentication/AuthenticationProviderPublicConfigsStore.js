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

import { getEnv, types } from 'mobx-state-tree';
import _ from 'lodash';
import { BaseStore } from '../BaseStore';
import { getAuthenticationProviderPublicConfigs } from '../../helpers/api';
import AuthenticationProviderPublicConfig from './AuthenticationProviderPublicConfig';

const AuthenticationProviderPublicConfigsStore = BaseStore.named('AuthenticationProviderPublicConfigsStore')
  .props({
    authenticationProviderPublicConfigs: types.optional(types.array(AuthenticationProviderPublicConfig), []),
  })
  .actions((self) => ({
    async doLoad() {
      const authenticationProviderPublicConfigs = await getAuthenticationProviderPublicConfigs();
      self.runInAction(() => {
        self.authenticationProviderPublicConfigs = authenticationProviderPublicConfigs;
        if (self.authenticationProviderPublicConfigs && !_.isEmpty(self.authenticationProviderPublicConfigs)) {
          const authentication = getEnv(self).authentication;
          authentication.setSelectedAuthenticationProviderId(self.authenticationProviderPublicConfigs[0].id);
        }
      });
    },
  }))
  .views((self) => ({
    get authenticationProviderOptions() {
      if (self.authenticationProviderPublicConfigs && !_.isEmpty(self.authenticationProviderPublicConfigs)) {
        const authProviderOptions = self.authenticationProviderPublicConfigs
          // Remove user pools as an option if native users are disabled
          .filter(
            (config) =>
              config.type !== 'cognito_user_pool' ||
              (config.type === 'cognito_user_pool' && config.enableNativeUserPoolUsers),
          )
          .map((config) => ({
            key: config.id,
            text: config.title,
            value: config.id,
          }));
        return authProviderOptions;
      }
      return [];
    },

    toAuthenticationProviderFromId(authenticationProviderId) {
      if (self.authenticationProviderPublicConfigs && !_.isEmpty(self.authenticationProviderPublicConfigs)) {
        return _.find(self.authenticationProviderPublicConfigs, { id: authenticationProviderId });
      }
      return undefined;
    },
  }));
function registerContextItems(appContext) {
  appContext.authenticationProviderPublicConfigsStore = AuthenticationProviderPublicConfigsStore.create({}, appContext);
}

export { AuthenticationProviderPublicConfigsStore, registerContextItems };
