import _ from 'lodash';
import { types } from 'mobx-state-tree';

import { consolidateToMap, mapToArray } from '@aws-ee/base-ui/dist/helpers/utils';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import {
  createEnvTypeConfig,
  deleteEnvTypeConfig,
  getAllEnvTypeConfigs,
  getEnvTypeConfigVars,
  updateEnvTypeConfig,
} from '../../helpers/api';
import { EnvTypeConfig } from './EnvTypeConfig';
import { EnvTypeConfigVar } from './EnvTypeConfigVar';

// ==================================================================
// EnvTypeConfigsStore
// ==================================================================
const EnvTypeConfigsStore = BaseStore.named('EnvTypeConfigsStore')
  .props({
    // Id of the EnvType
    id: types.identifier,

    // map of EnvTypeConfig with key = EnvTypeConfig.id, value = EnvTypeConfig MST model instance
    envTypeConfigs: types.optional(types.map(EnvTypeConfig), {}),

    // map of EnvTypeConfigVar with key = EnvTypeConfigVar.name, value = EnvTypeConfigVar MST model instance
    envTypeConfigVars: types.optional(types.map(EnvTypeConfigVar), {}),

    tickPeriod: 60 * 1000, // 1 minute
  })
  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const [envTypeConfigs, envTypeConfigVars] = await Promise.all([
          getAllEnvTypeConfigs(self.id),
          getEnvTypeConfigVars(self.id),
        ]);

        self.runInAction(() => {
          consolidateToMap(self.envTypeConfigs, envTypeConfigs || [], (exiting, newItem) => {
            exiting.setEnvTypeConfig(newItem);
          });
          consolidateToMap(
            self.envTypeConfigVars,
            envTypeConfigVars || [],
            (exiting, newItem) => {
              exiting.setEnvTypeConfigVar(newItem);
            },
            'name',
          );
        });
      },

      cleanup: () => {
        self.envTypes.clear();
        superCleanup();
      },

      async createEnvTypeConfig(envTypeConfig) {
        const createdEnvTypeConfig = await createEnvTypeConfig(self.id, envTypeConfig);
        self.runInAction(() => {
          // Add newly created env type to env types map
          const createdEnvTypeConfigModel = EnvTypeConfig.create(createdEnvTypeConfig);
          self.envTypeConfigs.set(createdEnvTypeConfigModel.id, createdEnvTypeConfigModel);
        });
      },

      async updateEnvTypeConfig(envTypeConfig) {
        const updatedEnvTypeConfig = await updateEnvTypeConfig(self.id, envTypeConfig);
        self.runInAction(() => {
          const previous = self.envTypeConfigs.get(updatedEnvTypeConfig.id);
          previous.setEnvTypeConfig(updatedEnvTypeConfig);
        });
      },

      async deleteEnvTypeConfig(envTypeConfigId) {
        await deleteEnvTypeConfig(self.id, envTypeConfigId);
        self.runInAction(() => {
          self.envTypeConfigs.delete(envTypeConfigId);
        });
      },
    };
  })
  .views(self => ({
    get list() {
      const arr = _.filter(mapToArray(self.envTypeConfigs), c => c.allowedToUse);
      return _.orderBy(arr, ['createdAt', 'name'], ['asc', 'asc']);
    },
    get listAll() {
      const arr = mapToArray(self.envTypeConfigs);
      return _.orderBy(arr, ['createdAt', 'name'], ['asc', 'asc']);
    },
    get empty() {
      return _.isEmpty(self.listAll);
    },
    getEnvTypeConfig(id) {
      return self.envTypeConfigs.get(id);
    },
  }));

// Note: Do NOT register this in the appContext, if you want to gain access to an instance
//       use EnvTypesStore.getEnvTypeConfigsStore()
export default EnvTypeConfigsStore;
export { EnvTypeConfigsStore };
