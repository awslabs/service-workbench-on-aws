/* eslint-disable import/prefer-default-export */
import { types, applySnapshot } from 'mobx-state-tree';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

const statuses = {
  active: {
    color: 'green',
    display: 'Active',
    tip: 'You can use this key when connecting to your workspaces.',
  },
  inactive: {
    color: 'grey',
    display: 'Inactive',
    tip: 'You can not use this key when connecting to your workspaces.',
  },
};

// ==================================================================
// KeyPair
// ==================================================================
const KeyPair = types
  .model('KeyPair', {
    id: types.identifier,
    rev: types.maybe(types.number),
    owner: types.optional(UserIdentifier, {}),
    name: '',
    status: '',
    publicKey: '',
    desc: types.maybeNull(types.string),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    privateKey: '', // The server will not return this value
  })
  .actions(self => ({
    setKeyPair(raw) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, raw);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get statusInfo() {
      const entry = statuses[self.status] || {
        color: 'grey',
        display: 'Unknown',
        tip: 'Something not right',
      };
      return entry;
    },
  }));

export { KeyPair };
