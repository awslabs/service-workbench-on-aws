import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getEnvType } from '../../helpers/api';

// ==================================================================
// EnvTypeStore
// ==================================================================
const EnvTypeStore = BaseStore.named('EnvTypeStore')
  .props({
    envTypeId: '',
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const rawEnv = await getEnvType(self.envTypeId);
        parent.addEnvType(rawEnv);
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get envType() {
      const parent = getParent(self, 2);
      const envType = parent.getEnvType(self.envTypeId);
      return envType;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use envTypesStore.getEnvTypeStore()
// eslint-disable-next-line import/prefer-default-export
export { EnvTypeStore };
