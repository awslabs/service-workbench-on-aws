import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getStudy } from '../../helpers/api';

// ==================================================================
// StudyStore
// ==================================================================
const StudyStore = BaseStore.named('StudyStore')
  .props({
    studyId: '',
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const rawStudy = await getStudy(self.studyId);
        parent.addStudy(rawStudy);
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get study() {
      const parent = getParent(self, 2);
      const w = parent.getStudy(self.studyId);
      return w;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use studiesStore.getStudyStore()
// eslint-disable-next-line import/prefer-default-export
export { StudyStore };
