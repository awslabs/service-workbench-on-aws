import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { getParent } from 'mobx-state-tree';
import { egressNotifySns, getEgressStore } from '../../helpers/api';
import { enableEgressStore } from '../../helpers/settings';

// ==================================================================
// ScEnvironmentEgressStoreDetailStore
// ==================================================================
const ScEnvironmentEgressStoreDetailStore = BaseStore.named('ScEnvironmentEgressStoreDetailStore')
  .props({
    envId: '',
    tickPeriod: 30 * 1000, // 30 seconds
  })

  .actions(self => {
    // TODO: add actions for getting egress store and init the store
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        // make API calls to fetch info
        const env = self.scEnvironment;
        const raw = await getEgressStore(self.envId);
        env.setEgressStoreDetails(raw);
      },

      async egressNotifySns(id) {
        if (enableEgressStore && enableEgressStore.toUpperCase() === 'TRUE') {
          await egressNotifySns(id);
        }
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
    get isAbleToSubmitEgressRequest() {
      // TODO: add fetch egress store status from self
      return 'waiting';
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { ScEnvironmentEgressStoreDetailStore };
