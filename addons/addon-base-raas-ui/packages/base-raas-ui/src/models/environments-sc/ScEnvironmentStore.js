import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getScEnvironment } from '../../helpers/api';

// ==================================================================
// ScEnvironmentStore
// ==================================================================
const ScEnvironmentStore = BaseStore.named('ScEnvironmentStore')
  .props({
    envId: '',
    tickPeriod: 30 * 1000, // 30 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const rawEnv = await getScEnvironment(self.envId);
        parent.addScEnvironment(rawEnv);
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get scEnvironment() {
      const parent = getParent(self, 2);
      const w = parent.getScEnvironment(self.envId);
      return w;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use scEnvironmentsStore.getScEnvironmentStore()
// eslint-disable-next-line import/prefer-default-export
export { ScEnvironmentStore };
