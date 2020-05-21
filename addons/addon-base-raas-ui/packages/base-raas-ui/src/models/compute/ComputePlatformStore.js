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
