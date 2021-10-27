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
/* eslint-disable import/prefer-default-export */
import { types, applySnapshot } from 'mobx-state-tree';

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
    owner: '',
    name: '',
    status: '',
    publicKey: '',
    desc: types.maybeNull(types.string),
    updatedAt: '',
    updatedBy: '',
    createdAt: '',
    createdBy: '',
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
