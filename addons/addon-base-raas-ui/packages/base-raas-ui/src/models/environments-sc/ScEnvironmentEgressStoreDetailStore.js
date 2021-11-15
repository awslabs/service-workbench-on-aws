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
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { getParent, types } from 'mobx-state-tree';
import { egressNotifySns, getEgressStore } from '../../helpers/api';
import { enableEgressStore } from '../../helpers/settings';

const S3Object = types.model('S3Object', {
  ETag: '',
  Key: '',
  LastModified: '',
  Size: '',
  StorageClass: '',
  projectId: '',
  workspaceId: '',
});

const egressStoreInfo = types.model('EgressStoreInfo', {
  objectList: types.optional(types.array(S3Object), []),
  isAbleToSubmitEgressRequest: types.optional(types.boolean, false),
});
// ==================================================================
// ScEnvironmentEgressStoreDetailStore
// ==================================================================
const ScEnvironmentEgressStoreDetailStore = BaseStore.named('ScEnvironmentEgressStoreDetailStore')
  .props({
    envId: '',
    tickPeriod: 30 * 1000, // 30 seconds,
    egressStoreDetails: types.optional(types.maybe(egressStoreInfo), {}),
  })

  .actions(self => {
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const raw = await getEgressStore(self.envId);
        self.runInAction(() => {
          self.egressStoreDetails = raw;
        });
      },

      async egressNotifySns(id) {
        if (enableEgressStore) {
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
    get list() {
      return self.egressStoreDetails.objectList;
    },
    get isAbleToSubmitEgressRequest() {
      return self.egressStoreDetails.isAbleToSubmitEgressRequest;
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { ScEnvironmentEgressStoreDetailStore };
