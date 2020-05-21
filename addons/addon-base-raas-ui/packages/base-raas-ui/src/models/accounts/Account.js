import { types, applySnapshot } from 'mobx-state-tree';

import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

const CfnInfo = types.model({
  crossAccountExecutionRoleArn: '',
  subnetId: '',
  vpcId: '',
  stackId: '',
});
// ==================================================================
// Account
// ==================================================================
const Account = types
  .model('Account', {
    id: types.identifier,
    accountName: '',
    status: '',
    accountArn: '',
    email: '',
    cfnInfo: types.optional(CfnInfo, {}),
    rev: types.maybe(types.number),
    name: '',
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
  })
  .actions(self => ({
    setAccount(rawAccount) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, rawAccount);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
  }));

// eslint-disable-next-line import/prefer-default-export
export { Account };
