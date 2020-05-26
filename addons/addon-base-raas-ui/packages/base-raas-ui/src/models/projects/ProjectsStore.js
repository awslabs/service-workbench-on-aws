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
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { getProjects, addProject } from '../../helpers/api';
import { Project } from './Project';
import { ProjectStore } from './ProjectStore';

// ==================================================================
// ProjectsStore
// ==================================================================
const ProjectsStore = BaseStore.named('ProjectsStore')
  .props({
    projects: types.optional(types.map(Project), {}),
    projectStores: types.optional(types.map(ProjectStore), {}),
    tickPeriod: 900 * 1000, // 15 minutes
  })

  .actions((self) => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const projects = await getProjects();
        // We try to preserve existing projects data and merge the new data instead
        // We could have used self.projects.replace(), but it will do clear() then merge()
        self.runInAction(() => {
          consolidateToMap(self.projects, projects, (exiting, newItem) => {
            exiting.setProject(newItem);
          });
        });
      },

      async addProject(rawProject) {
        const id = rawProject.id;
        const previous = self.projects.get(id);

        if (!previous) {
          self.projects.put(rawProject);
          await addProject(rawProject);
        } else {
          previous.setProject(rawProject);
        }
      },

      getProjectStore: (projectId) => {
        let entry = self.projectStores.get(projectId);
        if (!entry) {
          // Lazily create the store
          self.projectStores.set(projectId, ProjectStore.create({ projectId }));
          entry = self.projectStores.get(projectId);
        }

        return entry;
      },

      cleanup: () => {
        self.projects.clear();
        superCleanup();
      },
    };
  })

  .views((self) => ({
    get empty() {
      return self.projects.size === 0;
    },

    get total() {
      return self.projects.size;
    },

    get list() {
      const result = [];
      self.projects.forEach((project) => result.push(project));

      return _.reverse(_.sortBy(result, ['createdAt', 'id']));
    },

    get dropdownOptions() {
      const result = [];
      // converting map self.users to result array
      self.projects.forEach((project) => {
        const res = {};
        res.key = project.id;
        res.value = project.id;
        res.text = project.id;
        result.push(res);
      });

      return result;
    },

    hasProject(id) {
      return self.projects.has(id);
    },

    getProject(id) {
      return self.projects.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.projectsStore = ProjectsStore.create({}, appContext);
}

export { ProjectsStore, registerContextItems };
