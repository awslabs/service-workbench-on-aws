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

import { types, applySnapshot } from 'mobx-state-tree';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

import { WorkflowTemplateVersion } from '../WorkflowTemplate';

// ==================================================================
// WorkflowTemplateDraft
// ==================================================================
const WorkflowTemplateDraft = types
  .model('WorkflowTemplateDraft', {
    id: types.identifier,
    rev: types.maybe(types.number),
    username: '',
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    templateId: '',
    template: WorkflowTemplateVersion,
  })
  .actions(self => ({
    setWorkflowTemplateDraft(draft) {
      applySnapshot(self, draft);
    },

    setRev(rev) {
      self.rev = rev;
    },
  }))

  .views(_self => ({}));

export default WorkflowTemplateDraft;
