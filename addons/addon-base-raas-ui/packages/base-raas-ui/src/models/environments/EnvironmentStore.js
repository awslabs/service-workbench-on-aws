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

import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@amzn/base-ui/dist/models/BaseStore';
import { displayWarning } from '@amzn/base-ui/dist/helpers/notification';

import { getEnvironment, getEnvironmentCost } from '../../helpers/api';
import { getEstimatedCost } from '../../helpers/externalCostUtil';

// ==================================================================
// EnvironmentStore
// ==================================================================
const EnvironmentStore = BaseStore.named('EnvironmentStore')
  .props({
    environmentId: '',
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const rawEnvironment = await getEnvironment(self.environmentId);
        const envCreatedAt = new Date(rawEnvironment.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - envCreatedAt);
        const numberOfDaysBetweenDateCreatedAndToday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        try {
          const numberDaysInPast = Math.min(30, numberOfDaysBetweenDateCreatedAndToday);
          const environmentCost = rawEnvironment.isExternal
            ? await getEstimatedCost(rawEnvironment, numberDaysInPast)
            : await getEnvironmentCost(self.environmentId, numberDaysInPast);
          rawEnvironment.costs = environmentCost;
        } catch (error) {
          displayWarning('Error encountered retrieving cost data', error);
        }

        parent.addEnvironment(rawEnvironment);
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get environment() {
      const parent = getParent(self, 2);
      const w = parent.getEnvironment(self.environmentId);
      return w;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use environmentsStore.getEnvironmentStore()
// eslint-disable-next-line import/prefer-default-export
export { EnvironmentStore };
