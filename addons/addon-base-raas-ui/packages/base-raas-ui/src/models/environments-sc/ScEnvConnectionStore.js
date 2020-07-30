import _ from 'lodash';
import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import {
  getScEnvironmentConnections,
  sendSshKey,
  getWindowsRpInfo,
  createScEnvironmentConnectionUrl,
} from '../../helpers/api';

// ==================================================================
// ScEnvConnectionStore
// ==================================================================
const ScEnvConnectionStore = BaseStore.named('ScEnvConnectionStore')
  .props({
    envId: '',
    tickPeriod: 30 * 1000, // 30 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const env = self.scEnvironment;
        const raw = await getScEnvironmentConnections(self.envId);
        env.setConnections(raw);
      },

      async createConnectionUrl(connectionId) {
        const urlObj = await createScEnvironmentConnectionUrl(self.envId, connectionId);
        return _.get(urlObj, 'url');
      },

      async sendSshKey(connectionId, keyPairId) {
        return sendSshKey(self.envId, connectionId, keyPairId);
      },

      async getWindowsRdpInfo(connectionId) {
        return getWindowsRpInfo(self.envId, connectionId);
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
    get empty() {
      return _.isEmpty(self.scEnvironment.connections);
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use scEnvironmentsStore.getScEnvConnectionStore()
// eslint-disable-next-line import/prefer-default-export
export { ScEnvConnectionStore };
