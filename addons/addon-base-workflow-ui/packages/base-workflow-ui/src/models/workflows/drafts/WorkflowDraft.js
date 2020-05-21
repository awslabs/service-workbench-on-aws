import { types, applySnapshot } from 'mobx-state-tree';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

import { WorkflowVersion } from '../Workflow';

// ==================================================================
// WorkflowDraft
// ==================================================================
const WorkflowDraft = types
  .model('WorkflowDraft', {
    id: types.identifier,
    rev: types.maybe(types.number),
    username: '',
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    workflowId: '',
    workflowVer: types.maybe(types.number),
    templateId: '',
    templateVer: types.maybe(types.number),
    workflow: WorkflowVersion,
  })
  .actions(self => ({
    setWorkflowDraft(draft) {
      applySnapshot(self, draft);
    },

    setRev(rev) {
      self.rev = rev;
    },
  }))

  .views(_self => ({}));

export default WorkflowDraft;
