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

import { types, getParent } from 'mobx-state-tree';

// ==================================================================
// SubmitPhase
// ==================================================================
const SubmitPhase = types
  .model('SubmitPhase', {
    id: types.optional(types.identifier, 'submittingRequest'),
  })
  .actions(self => ({
    cleanup: () => {
      // TODO
    },
  }))

  .views(self => ({
    get wizard() {
      return getParent(self);
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { SubmitPhase };
