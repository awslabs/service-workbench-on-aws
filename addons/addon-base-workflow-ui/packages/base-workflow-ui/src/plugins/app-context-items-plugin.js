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
