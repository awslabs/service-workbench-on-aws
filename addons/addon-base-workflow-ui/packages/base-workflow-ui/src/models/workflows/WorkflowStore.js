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
import { types, getParent } from 'mobx-state-tree';
import { BaseStore } from '@amzn/base-ui/dist/models/BaseStore';

import { getWorkflow } from '../../helpers/api';
import { toWorkflows } from './Workflow';
import WorkflowInstancesStore from './WorkflowInstancesStore';
import WorkflowInstanceStore from './WorkflowInstanceStore';
import WorkflowAssignmentsStore from './WorkflowAssignmentsStore';

// ==================================================================
// WorkflowStore
// ==================================================================
const WorkflowStore = BaseStore.named('WorkflowStore')
  .props({
    workflowId: '',
    instancesStores: types.optional(types.map(WorkflowInstancesStore), {}),
    instanceStores: types.optional(types.map(WorkflowInstanceStore), {}),
    assignmentsStore: types.optional(types.map(WorkflowAssignmentsStore), {}),
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const workflowRaw = await getWorkflow(self.workflowId);
        const workflow = _.first(toWorkflows(workflowRaw));
        parent.addWorkflow(workflow);
      },

      getInstancesStore: (workflowId, workflowVer) => {
        const encodedId = `${workflowId}__${workflowVer}`;
        let entry = self.instancesStores.get(encodedId);
        if (!entry) {
          // Lazily create a WorkflowInstancesStore for each workflow version
          self.instancesStores.set(encodedId, WorkflowInstancesStore.create({ workflowId, workflowVer }));
          entry = self.instancesStores.get(encodedId);
        }

        return entry;
      },

      getInstanceStore: (workflowVer, instanceId) => {
        const workflowId = self.workflowId;
        const encodedId = `${workflowId}__${workflowVer}__${instanceId}`;
        let entry = self.instanceStores.get(encodedId);
        if (!entry) {
          // Lazily create a WorkflowInstanceStore for each workflow version
          self.instanceStores.set(encodedId, WorkflowInstanceStore.create({ workflowId, workflowVer, instanceId }));
          entry = self.instanceStores.get(encodedId);
        }

        return entry;
      },

      getAssignmentsStore: () => {
        const workflowId = self.workflowId;
        let entry = self.assignmentsStore.get(workflowId);
        if (!entry) {
          // Lazily create a WorkflowAssignmentsStore for each workflow
          self.assignmentsStore.set(workflowId, WorkflowAssignmentsStore.create({ workflowId }));
          entry = self.assignmentsStore.get(workflowId);
        }

        return entry;
      },

      cleanup: () => {
        self.instancesStores.clear();
        self.instanceStores.clear();
        self.assignmentsStore.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get workflow() {
      const parent = getParent(self, 2);
      const w = parent.getWorkflow(self.workflowId);
      return w;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use WorkflowsStore.getWorkflowStore()
export default WorkflowStore;
