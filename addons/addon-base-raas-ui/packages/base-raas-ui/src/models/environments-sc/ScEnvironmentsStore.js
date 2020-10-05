import _ from 'lodash';
import { values } from 'mobx';
import { getEnv, types } from 'mobx-state-tree';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getScEnvironments, createScEnvironment, deleteScEnvironment } from '../../helpers/api';
import { ScEnvironment } from './ScEnvironment';
import { ScEnvironmentStore } from './ScEnvironmentStore';
import { ScEnvConnectionStore } from './ScEnvConnectionStore';

const filterNames = {
  ALL: 'all',
  AVAILABLE: 'available',
  PENDING: 'pending',
  ERRORED: 'errored',
  TERMINATED: 'terminated',
};

// A map, with the key being the filter name and the value being the function that will be used to filter the workspace
const filters = {
  [filterNames.ALL]: () => true,
  [filterNames.AVAILABLE]: env => env.status === 'COMPLETED' || env.status === 'TAINTED',
  [filterNames.PENDING]: env => env.status === 'PENDING' || env.status === 'TERMINATING',
  [filterNames.ERRORED]: env => env.status === 'FAILED' || env.status === 'TERMINATING_FAILED',
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
    tickPeriod: 30 * 1000, // 30 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const environments = await getScEnvironments();
        self.runInAction(() => {
          consolidateToMap(self.environments, environments, (exiting, newItem) => {
            exiting.setScEnvironment(newItem);
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

      async createScEnvironment(environment) {
        // environment = { name, description, projectId, envTypeId, envTypeConfigId, studyIds (optional) }
        const result = await createScEnvironment(environment);
        self.addScEnvironment(result);
        return self.getScEnvironment(result.id);
      },

      async terminateScEnvironment(id) {
        await deleteScEnvironment(id);
        const env = self.getScEnvironment(id);
        if (!env) return;
        env.setStatus('TERMINATING');
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

      cleanup: () => {
        self.environments.clear();
        self.environmentStores.clear();
        self.connectionStores.clear();
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

    get user() {
      return getEnv(self).userStore.user;
    },
  }));

function registerContextItems(appContext) {
  appContext.scEnvironmentsStore = ScEnvironmentsStore.create({}, appContext);
}

export { ScEnvironmentsStore, registerContextItems, filterNames };
