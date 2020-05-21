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
