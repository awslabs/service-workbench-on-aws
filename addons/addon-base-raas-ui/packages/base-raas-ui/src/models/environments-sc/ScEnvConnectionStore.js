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
        return urlObj;
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
