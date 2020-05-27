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
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { getIndexes, addIndex } from '../../helpers/api';
import { Index } from './Index';

// ==================================================================
// IndexesStore
// ==================================================================
const IndexesStore = BaseStore.named('IndexesStore')
  .props({
    indexes: types.optional(types.map(Index), {}),
    tickPeriod: 900 * 1000, // 15 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const indexes = (await getIndexes()) || [];
        self.runInAction(() => {
          consolidateToMap(self.indexes, indexes, (exiting, newItem) => {
            exiting.setIndex(newItem);
          });
        });
      },

      addIndex: async index => {
        const addedIndex = await addIndex(index);
        self.runInAction(() => {
          // Added newly created user to users map
          const addedIndexModel = Index.create(addedIndex);
          self.indexes.set(addedIndexModel.id, addedIndexModel);
        });
      },

      getIndexesStore: indexesId => {
        let entry = self.indexesStores.get(indexesId);
        if (!entry) {
          // Lazily create the store
          self.indexesStores.set(indexesId, IndexesStore.create({ indexesId }));
          entry = self.indexesStores.get(indexesId);
        }

        return entry;
      },

      getIndex: indexesId => {
        let res = {};
        self.indexes.forEach(index => {
          if (index.id === indexesId) res = _.clone(index);
        });
        return res;
      },

      cleanup: () => {
        self.indexes.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get dropdownOptions() {
      const result = [];
      // converting map self.users to result array
      self.indexes.forEach(index => {
        const proj = {};
        proj.key = index.id;
        proj.value = index.id;
        proj.text = index.id;
        result.push(proj);
      });
      return result;
    },

    get empty() {
      return self.indexes.size === 0;
    },

    get total() {
      return self.indexes.size;
    },

    get list() {
      const result = [];
      self.indexes.forEach(indexes => result.push(indexes));

      return _.reverse(_.sortBy(result, ['createdAt', 'name']));
    },

    hasIndexes(id) {
      return self.indexes.has(id);
    },

    getIndexes(id) {
      return self.indexes.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.indexesStore = IndexesStore.create({}, appContext);
}

export { IndexesStore, registerContextItems };
