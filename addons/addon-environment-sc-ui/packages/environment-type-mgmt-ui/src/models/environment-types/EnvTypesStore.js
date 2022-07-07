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

import { BaseStore } from '@amzn/base-ui/dist/models/BaseStore';
import _ from 'lodash';
import { consolidateToMap, mapToArray } from '@amzn/base-ui/dist/helpers/utils';
import { EnvType } from './EnvType';
import {
  getAllEnvTypes,
  approveEnvType,
  revokeEnvType,
  deleteEnvType,
  createEnvType,
  updateEnvType,
} from '../../helpers/api';
import { EnvTypeConfigsStore } from './EnvTypeConfigsStore';
import { EnvTypeStore } from './EnvTypeStore';

// ==================================================================
// EnvTypesStore
// ==================================================================
const EnvTypesStore = BaseStore.named('EnvTypesStore')
  .props({
    // map of EnvTypes with key = id, value = EnvType MST model instance
    envTypes: types.optional(types.map(EnvType), {}),

    // map of EnvTypeStores with key = id, value = EnvTypeStore MST model instance
    envTypeStores: types.optional(types.map(EnvTypeStore), {}),

    // map of EnvTypeConfigsStores with key = id, value = EnvTypeConfigsStore MST model instance
    envTypeConfigsStores: types.optional(types.map(EnvTypeConfigsStore), {}),

    tickPeriod: 60 * 1000, // 1 minute
  })
  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const envTypes = (await getAllEnvTypes()) || [];
        self.runInAction(() => {
          consolidateToMap(self.envTypes, envTypes, (exiting, newItem) => {
            exiting.setEnvType(newItem);
          });
        });
      },

      addEnvType(rawEnvType) {
        const id = rawEnvType.id;
        const previous = self.envTypes.get(id);

        if (!previous) {
          self.envTypes.put(rawEnvType);
        } else {
          previous.setEnvType(rawEnvType);
        }
      },

      async createEnvType(envType) {
        const createdEnvType = await createEnvType(envType);
        self.runInAction(() => {
          // TODO replace this with a call to self.addEnvType() above
          // Add newly created env type to env types map
          const createdEnvTypeModel = EnvType.create(createdEnvType);
          self.envTypes.set(createdEnvTypeModel.id, createdEnvTypeModel);
        });
        // Addition or deletion of env type impacts env type candidates store
        // because imported env types are no longer candidates for import
        // let candidate store know that env type candidate is imported
        const appContext = getEnv(self);
        await appContext.envTypeCandidatesStore.onEnvTypeCandidateImport(envType.id);
      },

      async deleteEnvType(id) {
        await deleteEnvType(id);
        self.runInAction(() => {
          self.envTypes.delete(id);
        });
        // Addition or deletion of env type impacts env type candidates store
        // because delete env types are candidates for import again
        // reload env type candidates store as well
        const appContext = getEnv(self);
        await appContext.envTypeCandidatesStore.load();
      },

      async updateEnvType(envType) {
        const updatedEnvType = await updateEnvType(envType);
        self.runInAction(() => {
          const previousEnvType = self.envTypes.get(updatedEnvType.id);
          previousEnvType.setEnvType(updatedEnvType);
        });
      },

      async approveEnvType(id) {
        const previous = self.getEnvType(id);
        const updated = await approveEnvType(id, previous.rev);
        previous.setEnvType(updated);
      },

      async revokeEnvType(id) {
        const previous = self.getEnvType(id);
        const updated = await revokeEnvType(id, previous.rev);
        previous.setEnvType(updated);
      },

      getEnvTypeStore(envTypeId) {
        let entry = self.envTypeStores.get(envTypeId);
        if (!entry) {
          // Lazily create the store
          self.envTypeStores.set(envTypeId, EnvTypeStore.create({ envTypeId }));
          entry = self.envTypeStores.get(envTypeId);
        }

        return entry;
      },

      getEnvTypeConfigsStore(envTypeId) {
        let envTypeConfigsStore = self.envTypeConfigsStores.get(envTypeId);
        if (!envTypeConfigsStore) {
          self.envTypeConfigsStores.set(envTypeId, EnvTypeConfigsStore.create({ id: envTypeId }));
          envTypeConfigsStore = self.envTypeConfigsStores.get(envTypeId);
        }
        return envTypeConfigsStore;
      },

      cleanup: () => {
        self.envTypes.clear();
        self.envTypeStores.clear();
        self.envTypeConfigsStores.clear();
        superCleanup();
      },
    };
  })
  .views(self => ({
    get list() {
      return _.sortBy(mapToArray(self.envTypes), c => -1 * _.get(c, 'provisioningArtifact.createdTime'));
    },
    get listApproved() {
      return _.filter(self.list, 'isApproved');
    },
    get listNotApproved() {
      return _.filter(self.list, 'isNotApproved');
    },
    get empty() {
      return _.isEmpty(self.list);
    },
    getEnvType(id) {
      return self.envTypes.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.envTypesStore = EnvTypesStore.create({}, appContext);
}

export { EnvTypesStore, registerContextItems };
