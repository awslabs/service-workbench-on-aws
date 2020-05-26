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

import { types, getEnv, clone } from 'mobx-state-tree';
import { uiEventBus } from '@aws-ee/base-ui/dist/models/SessionStore';

import getEditWorkflowDraftMetaForm from '../../../forms/EditWorkflowDraftMetaForm';
import WorkflowStepEditor from './WorkflowStepEditor';

let globals; // a reference to the globals

// ==================================================================
// WorkflowDraftEditor
// ==================================================================
const WorkflowDraftEditor = types
  .model('WorkflowDraftEditor', {
    draftId: '',
    currentPage: 0, // there are only two pages, one for meta editing and one for steps editing
    numPages: 3,
    stepEditors: types.optional(types.map(WorkflowStepEditor), {}),
  })

  .volatile(_self => ({
    draftCopy: undefined,
    draftMetaForm: undefined,
  }))

  .actions(self => {
    // private
    function makeDraftCopy() {
      self.runInAction(() => {
        const draft = self.originalDraft;
        self.draftCopy = clone(draft);
        self.draftMetaForm = getEditWorkflowDraftMetaForm(self.draftCopy.workflow);
      });
    }

    return {
      // I had issues using runInAction from mobx
      // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
      runInAction(fn) {
        return fn();
      },

      afterCreate() {
        makeDraftCopy();
      },

      nextPage() {
        if (self.currentPage < self.numPages - 1) self.currentPage += 1;
        else self.currentPage = self.numPages - 1;
        return self.currentPage;
      },

      previousPage() {
        if (self.currentPage > 0) self.currentPage -= 1;
        else self.currentPage = 0;
        return self.currentPage;
      },

      cancel() {
        // We make a fresh copy in case the existing copy one was used
        makeDraftCopy();
        self.currentPage = 0;
      },

      getStepEditor(step) {
        const stepId = step.id;
        const entry = self.stepEditors.get(stepId) || WorkflowStepEditor.create({ stepId }, getEnv(self));

        self.stepEditors.set(stepId, entry);
        return entry;
      },

      removeStepEditor(stepId) {
        self.stepEditors.delete(stepId);
      },

      addStep(step) {
        const version = self.version;
        version.addStep(step);
      },

      async update(draft) {
        const updatedDraft = await self.workflowDraftsStore.updateDraft(draft);
        // The following code is not the greatest idea, but okay for this scenario, the correct approach would have
        // been to call makeDraftCopy(), however, this will result in losing some of the ui states in the draft card
        self.draft.setRev(updatedDraft.rev);
      },

      async publish(draft) {
        const result = await self.workflowDraftsStore.publishDraft(draft);

        // Remove the editor from the session store, if there were no errors
        if (!result.hasErrors) {
          await uiEventBus.fireEvent('workflowDraftDeleted', draft);
        }

        return result;
      },
    };
  })

  .views(self => ({
    get workflowDraftsStore() {
      return getEnv(self).workflowDraftsStore;
    },

    get hasNextPage() {
      return self.currentPage < self.numPages - 1;
    },

    get hasPreviousPage() {
      return self.currentPage > 0;
    },

    get originalDraft() {
      const store = self.workflowDraftsStore;
      return store.getDraft(self.draftId);
    },

    get draft() {
      return self.draftCopy;
    },

    // Returns a WorkflowVersion model object
    get version() {
      return self.draft.workflow;
    },

    get metaForm() {
      return self.draftMetaForm;
    },

    // Returns true if at least one step editor is in edit mode
    get stepEditorsEditing() {
      let found = false;
      /* eslint-disable no-restricted-syntax, no-unused-vars */
      for (const editor of self.stepEditors.values()) {
        if (editor.editing) {
          found = true;
          break;
        }
      }
      /* eslint-enable no-restricted-syntax, no-unused-vars */
      return found;
    },
  }));

function getWorkflowDraftEditor(draftId) {
  const sessionStore = globals.sessionStore;
  const id = encodeId(draftId);
  const entry = sessionStore.map.get(id) || WorkflowDraftEditor.create({ draftId }, globals);

  sessionStore.map.set(id, entry);
  return entry;
}

function encodeId(draftId) {
  return `WorkflowDraftEditor-${draftId}`;
}

function removeEditor(draftId) {
  const sessionStore = globals.sessionStore;
  const id = encodeId(draftId);

  sessionStore.removeStartsWith(id);
}

function registerContextItems(appContext) {
  // we are not actually registering anything here, just getting a reference to the appContext
  globals = appContext;

  uiEventBus.listenTo('workflowDraftDeleted', {
    id: 'WorkflowDraftEditor',
    listener: async event => {
      // event will be the draft object
      removeEditor(event.id);
    },
  });
}

export { WorkflowDraftEditor, getWorkflowDraftEditor, registerContextItems };
