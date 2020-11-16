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

// ==================================================================
// Index
// ==================================================================
const Index = types
  .model('Index', {
    id: types.identifier,
    rev: types.maybe(types.number),
    awsAccountId: '',
    description: '',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
  })
  .actions(self => ({
    setIndex(rawIndex) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, rawIndex);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    // add view methods here
  }));

// eslint-disable-next-line import/prefer-default-export
export { Index };
