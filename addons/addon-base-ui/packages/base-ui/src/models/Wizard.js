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
import _ from 'lodash';
import { types } from 'mobx-state-tree';

// ====================================================================================================================================
// Step
// ====================================================================================================================================
const Step = types
  .model('Step', {
    key: types.string,
    title: types.string,
    desc: types.optional(types.string, ''),
    isComplete: false,
  })
  .actions(self => ({
    setComplete(isComplete) {
      self.isComplete = isComplete;
    },
  }));

// ====================================================================================================================================
// Wizard
// ====================================================================================================================================
const Wizard = types
  .model('Wizard', {
    steps: types.array(Step),
    currentIdx: 0,
  })
  .actions(self => ({
    next() {
      if (self.hasNext) {
        self.currentIdx += 1;
      }
    },
    previous() {
      if (self.hasPrevious) {
        self.currentIdx -= 1;
      }
    },
    goTo(stepKey) {
      const stepIdx = _.findIndex(self.steps, { key: stepKey });
      if (stepIdx >= 0) {
        self.currentIdx = stepIdx;
      }
    },
  }))
  .views(self => ({
    get currentStep() {
      return self.steps[self.currentIdx];
    },
    get hasNext() {
      return self.currentIdx < self.steps.length - 1;
    },
    get hasPrevious() {
      return self.currentIdx > 0;
    },

    isStepActive(stepKey) {
      return _.findIndex(self.steps, { key: stepKey }) === self.currentIdx;
    },
  }));

function createWizard(steps, currentIdx = 0) {
  return Wizard.create({
    steps,
    currentIdx,
  });
}

export default Wizard;
export { Wizard, createWizard };
