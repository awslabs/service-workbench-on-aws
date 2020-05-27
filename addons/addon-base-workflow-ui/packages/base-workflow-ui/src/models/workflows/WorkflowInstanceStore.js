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

import { types, getParent } from 'mobx-state-tree';
import { BaseStore, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getWorkflowInstance } from '../../helpers/api';

// ==================================================================
// WorkflowInstanceStore
// ==================================================================
const WorkflowInstanceStore = BaseStore.named('WorkflowInstanceStore')
  .props({
    workflowId: '',
    workflowVer: types.number,
    instanceId: '',
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions((self) => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        if (!isStoreReady(parent)) {
          await parent.load();
        }
        const instance = await getWorkflowInstance(self.workflowId, self.workflowVer, self.instanceId);
        self.runInAction(() => {
          const version = self.version;
          if (!version) throw new Error(`Workflow "${self.workflowId}" v${self.workflowVer} does not exist`);
          version.setInstance(instance);
          const instanceMst = version.getInstance(self.instanceId);
          if (instanceMst && instanceMst.pending) {
            self.setFastTickPeriod();
          } else {
            self.setSlowTickPeriod();
          }
        });
      },

      setSlowTickPeriod() {
        self.changeTickPeriod(300 * 1000); // 5 minutes
      },

      setFastTickPeriod() {
        self.changeTickPeriod(5 * 1000); // 5 seconds
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views((self) => ({
    get version() {
      const parent = getParent(self, 2);
      const workflow = parent.workflow;
      if (!workflow) return undefined;
      return workflow.getVersion(self.workflowVer);
    },
  }));

// Note: Do NOT register this in the app context, if you want to gain access to an instance
//       use WorkflowStore.getWorkflowInstanceStore()
export default WorkflowInstanceStore;
