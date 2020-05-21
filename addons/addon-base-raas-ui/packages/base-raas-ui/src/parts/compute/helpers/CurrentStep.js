/* eslint-disable import/prefer-default-export */
import { types } from 'mobx-state-tree';

// ==================================================================
// CurrentStep
// ==================================================================
const CurrentStep = types
  .model('CurrentStep', {
    step: '',
  })

  .actions(self => ({
    setStep(step) {
      self.step = step;
    },
  }));

export { CurrentStep };
