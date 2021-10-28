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
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getScEnvironmentCost } from '../../helpers/api';
import { ScEnvironmentCost } from './ScEnvironmentCost';
import { ScEnvironmentCostStore } from './ScEnvironmentCostStore';

// WARNING WARNING WARNING WARNING WARNING
// ---------------------------------------
// This store is here as a temporary solution, in this store we call the cost api
// for each sc environment. This obviously is not scalable and should not be even an acceptable
// approach, but we need to have it here for now to maintain an existing behaviour.
// The cost api design needs to be addressed ASAP.
// ---------------------------------------
// WARNING WARNING WARNING WARNING WARNING

// ==================================================================
// ScEnvironmentCostsStore
// ==================================================================
const ScEnvironmentCostsStore = BaseStore.named('ScEnvironmentCostsStore')
  .props({
    costs: types.optional(types.map(ScEnvironmentCost), {}),
    costStores: types.optional(types.map(ScEnvironmentCostStore), {}),
    tickPeriod: 60 * 1000, // 60 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        // we need to check if the environment lists is loaded
        const scEnvironmentsStore = self.scEnvironmentsStore;
        if (!isStoreReady(scEnvironmentsStore)) {
          await scEnvironmentsStore.load();
        }

        const environments = scEnvironmentsStore.list;

        // 'getCost' is an async function that will attempt to load the
        // cost for the given environment, if an error occurs we
        // don't fail the whole outer doLoad() function.  We just
        // keep the error message in the 'error' props of the raw entity object
        const getCost = async environment => {
          const envId = environment.id;
          const rawEntity = { entries: [], id: `${envId}-cost`, error: '' };
          try {
            const entries = await getScEnvironmentCost(envId, 30);
            rawEntity.entries = entries;
          } catch (error) {
            const message = _.get(error, 'message') || _.get(error, 'friendly', 'Something went wrong');
            rawEntity.error = message;
          }

          return rawEntity;
        };

        const costs = await Promise.all(_.map(environments, env => getCost(env)));
        self.runInAction(() => {
          consolidateToMap(self.costs, costs, (exiting, newItem) => {
            exiting.setScEnvironmentCost(newItem);
          });
        });
      },

      addScEnvironmentCost(rawCost) {
        const id = rawCost.id;
        const previous = self.costs.get(id);

        if (!previous) {
          self.costs.put(rawCost);
        } else {
          previous.setScEnvironmentCost(rawCost);
        }
      },

      getScEnvironmentCostStore(envId) {
        let entry = self.costStores.get(envId);
        if (!entry) {
          // Lazily create the store
          self.costStores.set(envId, ScEnvironmentCostStore.create({ envId }));
          entry = self.costStores.get(envId);
        }

        return entry;
      },

      cleanup: () => {
        self.costStores.clear();
        self.costs.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.costs.size === 0;
    },

    getScEnvironmentCost(id) {
      return self.costs.get(`${id}-cost`);
    },

    get scEnvironmentsStore() {
      return getEnv(self).scEnvironmentsStore;
    },
  }));

function registerContextItems(appContext) {
  appContext.scEnvironmentCostsStore = ScEnvironmentCostsStore.create({}, appContext);
}

export { ScEnvironmentCostsStore, registerContextItems };
