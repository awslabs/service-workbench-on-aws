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
import { BaseStore, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getWorkflowAssignments } from '../../helpers/api';

// ==================================================================
// WorkflowAssignmentsStore
// ==================================================================
const WorkflowAssignmentsStore = BaseStore.named('WorkflowAssignmentsStore')
  .props({
    workflowId: '',
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
        const assignments = await getWorkflowAssignments(self.workflowId);
        self.runInAction(() => {
          const workflow = self.workflow;
          if (!workflow) throw new Error(`Workflow "${self.workflowId}" does not exist`);
          workflow.setAssignments(assignments);
        });
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views((self) => ({
    get assignments() {
      const workflow = self.workflow;
      if (!workflow) return [];
      return workflow.assignments;
    },

    get workflow() {
      const parent = getParent(self, 2);
      return parent.workflow;
    },

    get empty() {
      return self.assignments.length === 0;
    },

    get total() {
      return self.assignments.length;
    },

    get list() {
      const result = self.assignments.slice();

      return _.reverse(_.sortBy(result, ['createdAt']));
    },
  }));

// Note: Do NOT register this in the app context, if you want to gain access to an instance
//       use WorkflowStore.getWorkflowAssignmentsStore()
export default WorkflowAssignmentsStore;
