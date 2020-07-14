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
