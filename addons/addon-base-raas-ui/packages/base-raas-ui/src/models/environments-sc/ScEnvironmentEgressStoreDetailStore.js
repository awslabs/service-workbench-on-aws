import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

// ==================================================================
// ScEnvironmentEgressStoreDetailStore
// ==================================================================
const ScEnvironmentEgressStoreDetailStore = BaseStore.named('ScEnvironmentEgressStoreDetailStore')
  .props({ egressStoreStatus: '' })

  .actions(self => {
    // TODO: add actions for getting egress store and init the store
    const superCleanup = self.cleanup;

    return {
      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get egressStoreStatus() {
      // TODO: add fetch egress store status from self
      self.egressStoreStatus = 'waiting';
      return 'waiting';
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use scEnvironmentsStore.getScEnvironmentStore()
function registerContextItems(appContext) {
  appContext.scEnvironmentEgressStoreDetailStore = ScEnvironmentEgressStoreDetailStore.create({}, appContext);
}
// eslint-disable-next-line import/prefer-default-export
export { ScEnvironmentEgressStoreDetailStore, registerContextItems };
