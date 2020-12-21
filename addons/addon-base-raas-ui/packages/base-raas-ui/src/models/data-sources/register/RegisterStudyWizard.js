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

import { types } from 'mobx-state-tree';

import { InputPhase } from './InputPhase';
import { SubmitPhase } from './SubmitPhase';

// ==================================================================
// RegisterStudyWizard
// ==================================================================
const RegisterStudyWizard = types
  .model('RegisterStudyWizard', {
    phase: types.maybe(types.reference(types.union(InputPhase, SubmitPhase))),
    inputPhase: types.optional(InputPhase, {}),
    submitPhase: types.optional(SubmitPhase, {}),
  })
  .actions(self => ({
    afterCreate: () => {
      self.phase = self.inputPhase;
    },

    reset: () => {
      self.cleanup();
      self.phase = self.inputPhase;
    },

    cleanup: () => {
      self.phase = undefined;
      self.inputPhase.cleanup();
      self.submitPhase.cleanup();
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get isInputPhase() {
      return self.phase.id === self.inputPhase.id;
    },

    get isSubmitPhase() {
      return self.phase.id === self.submitPhase.id;
    },
  }));

function registerContextItems(appContext) {
  appContext.registerStudyWizard = RegisterStudyWizard.create({}, appContext);
}

export { RegisterStudyWizard, registerContextItems };
