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
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { getComputePlatforms } from '../../helpers/api';
import { ComputePlatform } from './ComputePlatform';
import { ComputePlatformStore } from './ComputePlatformStore';

// ==================================================================
// ComputePlatformsStore
// ==================================================================
const ComputePlatformsStore = BaseStore.named('ComputePlatformsStore')
  .props({
    platforms: types.map(ComputePlatform),
    platformsStores: types.map(ComputePlatformStore),
  })
  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const computePlatforms = await getComputePlatforms();
        self.runInAction(() => {
          consolidateToMap(self.platforms, computePlatforms, (exiting, newItem) => {
            exiting.setComputePlatform(newItem);
          });
        });
      },

      getComputePlatformStore(platformId) {
        let entry = self.platformsStores.get(platformId);
        if (!entry) {
          // Lazily create the store
          self.platformsStores.set(platformId, ComputePlatformStore.create({ platformId }));
          entry = self.platformsStores.get(platformId);
        }

        return entry;
      },

      cleanup() {
        self.platforms.clear();
        self.platformsStores.clear();
        superCleanup();
      },
    };
  })
  .views(self => ({
    get empty() {
      return self.platforms.size === 0;
    },

    get total() {
      return self.platforms.size;
    },

    get list() {
      return _.sortBy(values(self.platforms), 'displayOrder');
    },

    getComputePlatform(id) {
      return self.platforms.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.computePlatformsStore = ComputePlatformsStore.create({}, appContext);
}

export { ComputePlatformsStore, registerContextItems };
