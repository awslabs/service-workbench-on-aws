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
import { uiEventBus } from '@amzn/base-ui/dist/models/SessionStore';

import getEditWorkflowTemplateDraftMetaForm from '../../../forms/EditWorkflowTemplateDraftMetaForm';
import WorkflowTemplateStepEditor from './WorkflowTemplateStepEditor';

let globals; // a reference to the appContext

// ==================================================================
// WorkflowTemplateDraftEditor
// ==================================================================
const WorkflowTemplateDraftEditor = types
  .model('WorkflowTemplateDraftEditor', {
    draftId: '',
    currentPage: 0, // there are only two pages, one for meta editing and one for steps editing
    numPages: 3,
    stepEditors: types.optional(types.map(WorkflowTemplateStepEditor), {}),
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
        self.draftMetaForm = getEditWorkflowTemplateDraftMetaForm(self.draftCopy.template);
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
        const entry = self.stepEditors.get(stepId) || WorkflowTemplateStepEditor.create({ stepId }, getEnv(self));

        self.stepEditors.set(stepId, entry);
        return entry;
      },

      removeStepEditor(stepId) {
        self.stepEditors.delete(stepId);
      },

      addStep(step) {
        const template = self.draft.template;
        template.addStep(step);
      },

      async update(draft) {
        const updatedDraft = await self.workflowTemplateDraftsStore.updateDraft(draft);
        // The following code is not the greatest idea, but okay for this scenario, the correct approach would have
        // been to call makeDraftCopy(), however, this will result in losing some of the ui states in the draft card
        self.draft.setRev(updatedDraft.rev);
      },

      async publish(draft) {
        const result = await self.workflowTemplateDraftsStore.publishDraft(draft);

        // Remove the wizard from the session store, if there were no errors
        if (!result.hasErrors) {
          await uiEventBus.fireEvent('workflowTemplateDraftDeleted', draft);
        }

        return result;
      },
    };
  })

  .views(self => ({
    get workflowTemplateDraftsStore() {
      return getEnv(self).workflowTemplateDraftsStore;
    },

    get hasNextPage() {
      return self.currentPage < self.numPages - 1;
    },

    get hasPreviousPage() {
      return self.currentPage > 0;
    },

    get originalDraft() {
      const store = self.workflowTemplateDraftsStore;
      return store.getDraft(self.draftId);
    },

    get draft() {
      return self.draftCopy;
    },

    // Returns a WorkflowTemplateVersion model object
    get version() {
      return self.draft.template;
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

function getWorkflowTemplateDraftEditor(draftId) {
  const sessionStore = globals.sessionStore;
  const id = encodeId(draftId);
  const entry = sessionStore.map.get(id) || WorkflowTemplateDraftEditor.create({ draftId }, globals);

  sessionStore.map.set(id, entry);
  return entry;
}

function encodeId(draftId) {
  return `WorkflowTemplateDraftEditor-${draftId}`;
}

function removeWizard(draftId) {
  const sessionStore = globals.sessionStore;
  const id = encodeId(draftId);

  sessionStore.removeStartsWith(id);
}

function registerContextItems(appContext) {
  // we are not actually registering anything here, just getting a reference to the appContext
  globals = appContext;

  uiEventBus.listenTo('workflowTemplateDraftDeleted', {
    id: 'WorkflowTemplateDraftEditor',
    listener: async event => {
      // event will be the draft object
      removeWizard(event.id);
    },
  });
}

export { WorkflowTemplateDraftEditor, getWorkflowTemplateDraftEditor, registerContextItems };
