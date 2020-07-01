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
  .actions(self => ({
    async doLoad() {
      const configs = await getAuthenticationProviderPublicConfigs();

      self.runInAction(() => {
        self.authenticationProviderPublicConfigs = configs;
        const authentication = getEnv(self).authentication;
        const selected = _.get(configs, '[0].id', '');
        authentication.setSelectedAuthenticationProviderId(selected);
      });
    },
  }))
  .views(self => ({
    get authenticationProviderOptions() {
      const size = _.size(self.authenticationProviderPublicConfigs);

      // We don't do any filtering if we only have one configuration
      if (size === 1) {
        const entry = self.authenticationProviderPublicConfigs[0];
        return [
          {
            key: entry.id,
            text: entry.title,
            value: entry.id,
          },
        ];
      }

      // We need to loop through all the configurations and remove any entry
      // that is of type cognito_user_pool but only if enableNativeUserPoolUsers = false
      const result = [];
      _.forEach(self.authenticationProviderPublicConfigs, config => {
        if (config.type === 'cognito_user_pool' && !config.enableNativeUserPoolUsers) return;
        result.push({
          key: config.id,
          text: config.title,
          value: config.id,
        });
      });

      return result;
    },

    toAuthenticationProviderFromId(authenticationProviderId) {
      return _.find(self.authenticationProviderPublicConfigs, { id: authenticationProviderId });
    },
  }));

function registerContextItems(appContext) {
  appContext.authenticationProviderPublicConfigsStore = AuthenticationProviderPublicConfigsStore.create({}, appContext);
}

export { AuthenticationProviderPublicConfigsStore, registerContextItems };
