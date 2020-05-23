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

/* eslint-disable import/prefer-default-export */
import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getComputeConfigurations } from '../../helpers/api';

// ==================================================================
// ComputePlatformStore
// ==================================================================
const ComputePlatformStore = BaseStore.named('ComputePlatformStore')
  .props({
    platformId: '',
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const configurations = await getComputeConfigurations(self.platformId);
        const platform = self.computePlatform;
        if (!platform) return;
        platform.setConfigurations(configurations);
      },

      cleanup: () => {
        self.platformId = '';
        superCleanup();
      },
    };
  })

  .views(self => ({
    get computePlatform() {
      const parent = getParent(self, 2);
      const platform = parent.getComputePlatform(self.platformId);
      return platform;
    },
  }));

// Note: Do NOT register this in the app context, if you want to gain access to an instance
//       use computePlatformsStore.getComputePlatformStore()
export { ComputePlatformStore };
