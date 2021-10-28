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
import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getScEnvironmentCost } from '../../helpers/api';

// ==================================================================
// ScEnvironmentCostStore
// ==================================================================
const ScEnvironmentCostStore = BaseStore.named('ScEnvironmentCostStore')
  .props({
    envId: '',
    tickPeriod: 12 * 60 * 60 * 1000, // 12 hours
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const id = self.envId;
        const parent = getParent(self, 2);
        const rawEntity = { entries: [], id: `${id}-cost`, error: '' };
        // We are breaking the norm here by doing a try/catch. This is because we also want
        // to update the entity.error value based on if we received an error. In general,
        // entity models don't have 'error' property that reflects the loading status, this is
        // because the 'error' property belongs to the store.
        try {
          const entries = await getScEnvironmentCost(id, 30);
          rawEntity.entries = entries;
          parent.addScEnvironmentCost(rawEntity);
        } catch (error) {
          const message = _.get(error, 'message') || _.get(error, 'friendly', 'Something went wrong');
          rawEntity.error = message;
          parent.addScEnvironmentCost(rawEntity);
          // We want to throw an error here so that the store can be in the correct state
          throw error;
        }
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get scEnvironmentCost() {
      const parent = getParent(self, 2);
      const cost = parent.getScEnvironmentCost(self.envId);
      return cost;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use scEnvironmentCostsStore.getScEnvironmentCostStore()
// eslint-disable-next-line import/prefer-default-export
export { ScEnvironmentCostStore };
