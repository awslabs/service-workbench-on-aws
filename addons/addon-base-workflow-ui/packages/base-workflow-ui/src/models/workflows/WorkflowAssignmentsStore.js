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

  .actions(self => {
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

  .views(self => ({
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
