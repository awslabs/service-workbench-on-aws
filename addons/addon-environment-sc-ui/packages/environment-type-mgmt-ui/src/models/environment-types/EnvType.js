import { types, applySnapshot } from 'mobx-state-tree';

import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';
import { EnvTypeCandidate } from './EnvTypeCandidate';
import { getValidStatuses, isApproved, isNotApproved } from './EnvTypeStatusEnum';

// ====================================================================================================================================
// EnvType -- (is an EnvTypeCandidate that's already imported)
// ====================================================================================================================================
const EnvType = EnvTypeCandidate.named('EnvType')
  .props({
    rev: 0,
    status: types.enumeration('EnvTypeStatus', getValidStatuses()),
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
  })
  .actions(self => ({
    setEnvType(envType) {
      applySnapshot(self, envType);
    },
  }))
  .views(self => ({
    get isApproved() {
      return isApproved(self.status);
    },
    get isNotApproved() {
      return isNotApproved(self.status);
    },
  }));

export default EnvType;
export { EnvType };
