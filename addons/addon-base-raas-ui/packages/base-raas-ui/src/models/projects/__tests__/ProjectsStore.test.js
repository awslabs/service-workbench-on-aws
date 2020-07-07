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

import { ProjectsStore } from '../ProjectsStore';

import { getProjects, addProject, updateProject } from '../../../helpers/api';

jest.mock('../../../helpers/api');

describe('ProjectsStore', () => {
  let store = null;
  const newProject = {
    id: 'aCreativeName!',
    rev: 1,
    description: 'simple description',
    indexId: '10',
    createdAt: 'now',
    updatedAt: 'later',
  };

  const diffProject = {
    id: 'anotherCreativeName',
    rev: 1,
    description: 'simple description',
    indexId: '11',
    createdAt: 'before',
    updatedAt: 'after',
  };

  describe('add project', () => {
    it('should add a project', async () => {
      // BUILD
      getProjects.mockResolvedValueOnce([]);
      store = ProjectsStore.create({}, {});
      await store.load();

      // OPERATE
      await store.addProject(newProject);

      // CHECK
      expect(addProject).toHaveBeenCalledWith(newProject);
    });

    it('should not add the project because it already exists', async () => {
      // BUILD
      getProjects.mockResolvedValueOnce([diffProject]);
      store = ProjectsStore.create({}, {});
      await store.load();

      // OPERATE
      await store.addProject(diffProject);

      // CHECK
      expect(addProject).not.toHaveBeenCalledWith(diffProject);
    });
  });

  describe('update project', () => {
    it('should try to add the updated function', async () => {
      // BUILD
      getProjects.mockResolvedValueOnce([newProject]);
      store = ProjectsStore.create({}, {});
      await store.load();

      updateProject.mockResolvedValueOnce(diffProject);
      store.addProject = jest.fn();

      // OPERATE
      await store.updateProject(diffProject);

      // CHECK
      expect(store.addProject).toHaveBeenCalledWith(diffProject);
    });
  });
});
