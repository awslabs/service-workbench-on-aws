import _ from 'lodash';
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { uiEventBus } from '@aws-ee/base-ui/dist/models/SessionStore';

import { getWorkflows } from '../../helpers/api';
import { Workflow, toWorkflows } from './Workflow';
import WorkflowStore from './WorkflowStore';

// ==================================================================
// WorkflowsStore
// ==================================================================
const WorkflowsStore = BaseStore.named('WorkflowsStore')
  .props({
    workflows: types.optional(types.map(Workflow), {}),
    workflowStores: types.optional(types.map(WorkflowStore), {}),
    tickPeriod: 900 * 1000, // 15 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const versions = await getWorkflows();
        const workflows = toWorkflows(versions);

        // we try to preserve existing workflow versions data and merge the new data instead
        self.runInAction(() => {
          const previousKeys = {};
          self.workflows.forEach((_value, key) => {
            previousKeys[key] = true;
          });
          workflows.forEach(workflow => {
            const id = workflow.id;
            const hasPrevious = self.workflows.has(id);

            self.addWorkflow(workflow);

            if (hasPrevious) {
              delete previousKeys[id];
            }
          });

          _.forEach(previousKeys, (_value, key) => {
            self.workflows.delete(key);
          });
        });
      },

      addWorkflow(rawWorkflow) {
        if (!rawWorkflow) return;
        const id = rawWorkflow.id;
        const previous = self.workflows.get(id);

        if (!previous) {
          self.workflows.put(rawWorkflow);
        } else {
          previous.setWorkflow(rawWorkflow);
        }
      },

      getWorkflowStore: workflowId => {
        let entry = self.workflowStores.get(workflowId);
        if (!entry) {
          // Lazily create the store
          self.workflowStores.set(workflowId, WorkflowStore.create({ workflowId }));
          entry = self.workflowStores.get(workflowId);
        }

        return entry;
      },

      cleanup: () => {
        self.workflows.clear();
        self.workflowStores.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.workflows.size === 0;
    },

    get total() {
      return self.workflows.size;
    },

    get list() {
      const result = [];
      self.workflows.forEach(workflow => result.push(workflow));

      return _.reverse(_.sortBy(result, ['latest.createdAt', 'title']));
    },

    getWorkflow(id) {
      return self.workflows.get(id);
    },

    hasWorkflow(id) {
      return self.workflows.has(id);
    },

    asDropDownOptions() {
      const result = [];
      self.workflows.forEach(wf => {
        const latestWfVersion = wf.latest.v;
        wf.versions.forEach(wfv => {
          result.push({
            key: wf.id,
            value: JSON.stringify({ wid: wf.id, wrv: wfv.v }),
            text: wfv.v === latestWfVersion ? `${wf.id} (latest)` : `${wf.id} (v${wfv.v})`,
            // content:
            //   wfv.v === latestWfVersion ? (
            //     <Label as="a" color="blue" image>
            //       {wf.id}
            //       <Label.Detail>latest version</Label.Detail>
            //     </Label>
            //   ) : (
            //     <Label as="a" color="grey" image>
            //       {wf.id}
            //       <Label.Detail>v{wfv.v}</Label.Detail>
            //     </Label>
            //   ),
          });
        });
      });
      return result;
    },
  }));

function registerContextItems(appContext) {
  appContext.workflowsStore = WorkflowsStore.create({}, appContext);

  uiEventBus.listenTo('workflowPublished', {
    id: 'WorkflowsStore',
    listener: async _event => {
      appContext.workflowsStore.cleanup();
    },
  });
}

export { WorkflowsStore, registerContextItems };
