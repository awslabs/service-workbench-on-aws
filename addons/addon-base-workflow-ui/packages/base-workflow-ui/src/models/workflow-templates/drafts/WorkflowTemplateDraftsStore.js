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
import { types, getSnapshot, getEnv } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import {
  getWorkflowTemplateDrafts,
  createWorkflowTemplateDraft,
  updateWorkflowTemplateDraft,
  publishWorkflowTemplateDraft,
  deleteWorkflowTemplateDraft,
} from '../../../helpers/api';
import WorkflowTemplateDraft from './WorkflowTemplateDraft';

// ==================================================================
// WorkflowTemplateDraftsStore
// ==================================================================
const WorkflowTemplateDraftsStore = BaseStore.named('WorkflowTemplateDraftsStore')
  .props({
    drafts: types.optional(types.map(WorkflowTemplateDraft), {}),
    tickPeriod: 900 * 1000, // 15 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    // private
    function normalizeForSubmission(draft) {
      const normalizedDraft = _.cloneDeep(getSnapshot(draft));
      _.forEach(normalizedDraft.template.selectedSteps, step => {
        delete step.stepTemplate;
      });

      return normalizedDraft;
    }

    return {
      async doLoad() {
        const drafts = await getWorkflowTemplateDrafts();

        // We try to preserve existing drafts data and merge the new data instead
        // We could have used self.drafts.replace(), but it will do clear().merge()
        self.runInAction(() => {
          const previousKeys = {};
          self.drafts.forEach((value, key) => {
            previousKeys[key] = true;
          });
          drafts.forEach(draft => {
            const id = draft.id;
            const hasPrevious = self.drafts.has(id);

            self.addDraft(draft);

            if (hasPrevious) {
              delete previousKeys[id];
            }
          });

          _.forEach(previousKeys, (value, key) => {
            self.drafts.delete(key);
          });
        });
      },

      addDraft(rawDraft) {
        const id = rawDraft.id;
        const previous = self.drafts.get(id);

        if (!previous) {
          self.drafts.put(rawDraft);
        } else {
          previous.setWorkflowTemplateDraft(rawDraft);
        }
      },

      async updateDraft(draft) {
        const id = draft.id;
        const previous = self.drafts.get(id);
        if (previous === undefined) throw new Error(`Workflow Template Draft "${id}" does not exist`);

        const updated = await updateWorkflowTemplateDraft(normalizeForSubmission(draft));
        previous.setWorkflowTemplateDraft(updated);

        return previous;
      },

      async createDraft({ isNewTemplate, templateId, templateTitle }) {
        const draft = await createWorkflowTemplateDraft({ isNewTemplate, templateId, templateTitle });
        self.addDraft(draft);

        return draft;
      },

      async publishDraft(draft) {
        const id = draft.id;
        const previous = self.drafts.get(id);
        if (previous === undefined) throw new Error(`Workflow Template Draft "${id}" does not exist`);

        const publishResult = await publishWorkflowTemplateDraft(normalizeForSubmission(draft));

        self.runInAction(() => {
          if (!publishResult.hasErrors) self.drafts.delete(id);
        });

        return publishResult;
      },

      async deleteDraft(draft) {
        const uiEventBus = getEnv(self).uiEventBus;
        await deleteWorkflowTemplateDraft(draft);
        await uiEventBus.fireEvent('workflowTemplateDraftDeleted', draft);
        self.runInAction(() => {
          self.drafts.delete(draft.id);
        });
      },

      cleanup: () => {
        self.drafts.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.drafts.size === 0;
    },

    get total() {
      return self.drafts.size;
    },

    get list() {
      const result = [];
      self.drafts.forEach(drafts => result.push(drafts));

      return _.reverse(_.sortBy(result, ['createdAt', 'title']));
    },

    hasTemplate(templateId) {
      let found = false;
      /* eslint-disable no-restricted-syntax, no-unused-vars */
      for (const draft of self.drafts.values()) {
        if (draft.template.id === templateId) {
          found = true;
          break;
        }
      }
      /* eslint-enable no-restricted-syntax, no-unused-vars */

      return found;
    },

    hasDraft(draftId) {
      return self.drafts.has(draftId);
    },

    getDraft(id) {
      return self.drafts.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.workflowTemplateDraftsStore = WorkflowTemplateDraftsStore.create({}, appContext);
}

export { WorkflowTemplateDraftsStore, registerContextItems };
