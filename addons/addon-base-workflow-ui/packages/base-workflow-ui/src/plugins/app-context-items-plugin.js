import * as stepTemplatesStore from '../models/workflow-step-templates/StepTemplatesStore';
import * as workflowTemplateDraftEditor from '../models/workflow-templates/drafts/edit/WorkflowTemplateDraftEditor';
import * as workflowTemplateDraftsStore from '../models/workflow-templates/drafts/WorkflowTemplateDraftsStore';
import * as workflowTemplatesStore from '../models/workflow-templates/WorkflowTemplatesStore';
import * as workflowDraftEditor from '../models/workflows/drafts/edit/WorkflowDraftEditor';
import * as workflowDraftsStore from '../models/workflows/drafts/WorkflowDraftsStore';
import * as workflowsStore from '../models/workflows/WorkflowsStore';

// eslint-disable-next-line no-unused-vars
function registerAppContextItems(appContext) {
  stepTemplatesStore.registerContextItems(appContext);
  workflowTemplateDraftEditor.registerContextItems(appContext);
  workflowTemplateDraftsStore.registerContextItems(appContext);
  workflowTemplatesStore.registerContextItems(appContext);
  workflowDraftEditor.registerContextItems(appContext);
  workflowDraftsStore.registerContextItems(appContext);
  workflowsStore.registerContextItems(appContext);
}

// eslint-disable-next-line no-unused-vars
function postRegisterAppContextItems(appContext) {
  // No impl at this level
}

const plugin = {
  registerAppContextItems,
  postRegisterAppContextItems,
};

export default plugin;
