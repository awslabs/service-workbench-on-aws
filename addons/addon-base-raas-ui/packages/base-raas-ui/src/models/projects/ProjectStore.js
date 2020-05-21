import { getParent } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getProject } from '../../helpers/api';

// ==================================================================
// ProjectStore
// ==================================================================
const ProjectStore = BaseStore.named('ProjectStore')
  .props({
    projectId: '',
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const parent = getParent(self, 2);
        const rawProject = await getProject(self.projectId);
        parent.addProject(rawProject);
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get project() {
      const parent = getParent(self, 2);
      const w = parent.getProject(self.projectId);
      return w;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use projectsStore.getProjectStore()
// eslint-disable-next-line import/prefer-default-export
export { ProjectStore };
