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
import { values } from 'mobx';
import { getEnv, types } from 'mobx-state-tree';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import {
  getScEnvironments,
  createScEnvironment,
  deleteScEnvironment,
  startScEnvironment,
  stopScEnvironment,
  updateScEnvironmentCidrs,
  deleteEgressStore,
} from '../../helpers/api';

import { ScEnvironment } from './ScEnvironment';
import { ScEnvironmentStore } from './ScEnvironmentStore';
import { ScEnvConnectionStore } from './ScEnvConnectionStore';
import { ScEnvironmentEgressStoreDetailStore } from './ScEnvironmentEgressStoreDetailStore';
import { enableEgressStore } from '../../helpers/settings';

const filterNames = {
  ALL: 'all',
  AVAILABLE: 'available',
  STOPPED: 'stopped',
  PENDING: 'pending',
  ERRORED: 'errored',
  TERMINATED: 'terminated',
};

// A map, with the key being the filter name and the value being the function that will be used to filter the workspace
const filters = {
  [filterNames.ALL]: () => true,
  [filterNames.AVAILABLE]: env => env.status === 'COMPLETED' || env.status === 'TAINTED',
  [filterNames.STOPPED]: env => env.status === 'STOPPED',
  [filterNames.PENDING]: env =>
    env.status === 'PENDING' || env.status === 'TERMINATING' || env.status === 'STARTING' || env.status === 'STOPPING',
  [filterNames.ERRORED]: env =>
    env.status === 'FAILED' ||
    env.status === 'TERMINATING_FAILED' ||
    env.status === 'STARTING_FAILED' ||
    env.status === 'STOPPING_FAILED',
  [filterNames.TERMINATED]: env => env.status === 'TERMINATED',
};

// ==================================================================
// ScEnvironmentsStore
// ==================================================================
const ScEnvironmentsStore = BaseStore.named('ScEnvironmentsStore')
  .props({
    environments: types.optional(types.map(ScEnvironment), {}),
    environmentStores: types.optional(types.map(ScEnvironmentStore), {}),
    connectionStores: types.optional(types.map(ScEnvConnectionStore), {}),
    egressStoreDetailStore: types.optional(types.map(ScEnvironmentEgressStoreDetailStore), {}),
    tickPeriod: 30 * 1000, // 30 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const environments = await getScEnvironments();
        self.runInAction(() => {
          consolidateToMap(self.environments, environments, (existing, newItem) => {
            existing.setScEnvironment(newItem);
          });
        });
      },

      addScEnvironment(rawEnvironment) {
        const id = rawEnvironment.id;
        const previous = self.environments.get(id);

        if (!previous) {
          self.environments.put(rawEnvironment);
        } else {
          previous.setScEnvironment(rawEnvironment);
        }
      },

      async updateScEnvironmentCidrs(envId, updateRequest) {
        const result = await updateScEnvironmentCidrs(envId, updateRequest);
        const env = self.getScEnvironment(envId);
        env.setScEnvironment(result);
        return env;
      },

      async createScEnvironment(environment) {
        const result = await createScEnvironment(environment);
        self.addScEnvironment(result);
        return self.getScEnvironment(result.id);
      },

      async terminateScEnvironment(id) {
        if (enableEgressStore) {
          await deleteEgressStore(id);
        }
        await deleteScEnvironment(id);
        const env = self.getScEnvironment(id);
        if (!env) return;
        env.setStatus('TERMINATING');
      },

      async startScEnvironment(id) {
        await startScEnvironment(id);
        const env = self.getScEnvironment(id);
        if (!env) return;
        env.setStatus('STARTING');
      },

      async stopScEnvironment(id) {
        await stopScEnvironment(id);
        const env = self.getScEnvironment(id);
        if (!env) return;
        env.setStatus('STOPPING');
      },

      getScEnvironmentStore(envId) {
        let entry = self.environmentStores.get(envId);
        if (!entry) {
          // Lazily create the store
          self.environmentStores.set(envId, ScEnvironmentStore.create({ envId }));
          entry = self.environmentStores.get(envId);
        }

        return entry;
      },

      getScEnvConnectionStore(envId) {
        let entry = self.connectionStores.get(envId);
        if (!entry) {
          // Lazily create the store
          self.connectionStores.set(envId, ScEnvConnectionStore.create({ envId }));
          entry = self.connectionStores.get(envId);
        }

        return entry;
      },

      getScEnvironmentEgressStoreDetailStore(envId) {
        let entry = self.egressStoreDetailStore.get(envId);
        if (!entry) {
          // Lazily create the store
          self.egressStoreDetailStore.set(envId, ScEnvironmentEgressStoreDetailStore.create({ envId }));
          entry = self.egressStoreDetailStore.get(envId);
        }
        return entry;
      },

      cleanup: () => {
        self.environments.clear();
        self.environmentStores.clear();
        self.connectionStores.clear();
        self.egressStoreDetailStore.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.environments.size === 0;
    },

    get total() {
      return self.environments.size;
    },

    get list() {
      return _.orderBy(values(self.environments), ['createdAt', 'name'], ['desc', 'asc']);
    },

    filtered(filterName) {
      const filter = filters[filterName] || (() => true);
      const filtered = _.filter(values(self.environments), filter);
      return _.orderBy(filtered, ['createdAt', 'name'], ['desc', 'asc']);
    },

    getScEnvironment(id) {
      return self.environments.get(id);
    },

    canChangeState(id) {
      const outputs = self.environments.get(id).outputs;
      let result = false;
      outputs.forEach(output => {
        if (output.OutputKey === 'Ec2WorkspaceInstanceId' || output.OutputKey === 'NotebookInstanceName') {
          result = true;
        }
      });
      return result;
    },

    get user() {
      return getEnv(self).userStore.user;
    },
  }));

function registerContextItems(appContext) {
  appContext.scEnvironmentsStore = ScEnvironmentsStore.create({}, appContext);
}

export { ScEnvironmentsStore, registerContextItems, filterNames };
