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
import { types } from 'mobx-state-tree';
import { BaseStore } from '@amzn/base-ui/dist/models/BaseStore';
import { consolidateToMap } from '@amzn/base-ui/dist/helpers/utils';

import { EnvironmentConfiguration } from './EnvironmentConfiguration';

const EnvironmentConfigurationsStore = BaseStore.named('EnvironmentConfigurationsStore')
  .props({
    configurations: types.map(EnvironmentConfiguration),
    heartbeatInterval: -1,
  })
  .actions(self => {
    return {
      async doLoad() {
        const environmentConfigurations = await getEnvironmentConfigurations();

        self.runInAction(() => {
          consolidateToMap(self.configurations, environmentConfigurations, (exiting, newItem) => {
            exiting.setEnvironmentConfiguration(newItem);
          });
        });
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.configurations.size === 0;
    },

    get total() {
      return self.configurations.size;
    },

    get list() {
      const result = [];
      self.configurations.forEach(configuration => result.push(configuration));

      return _.sortBy(result, ['id']);
    },

    getConfiguration(id) {
      return self.configurations.get(id);
    },
  }));

async function getEnvironmentConfigurations() {
  return [];
}

function registerContextItems(appContext) {
  appContext.environmentConfigurationsStore = EnvironmentConfigurationsStore.create({}, appContext);
}

export { EnvironmentConfigurationsStore, registerContextItems };
