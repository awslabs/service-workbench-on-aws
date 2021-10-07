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

import ProjectConfigure from '../ProjectConfigure';

jest.mock('@aws-ee/base-ui/dist/helpers/notification');
const notificationMock = require('@aws-ee/base-ui/dist/helpers/notification');

const usersStore = {};
const userStore = {};
const awsAccountsStore = {};
const projectsStore = {};
const project = {
  rev: 2,
  id: 'id',
  description: 'desc',
  indexId: 'idxid',
  projectAdmins: ['admin1', 'admin2'],
};
describe('ProjectConfigure', () => {
  let component = null;

  beforeEach(() => {
    // Can't use enzyme, ProjectConfigure doesn't implement wrappedComponent or WrappedComponent
    component = new ProjectConfigure({ usersStore, userStore, awsAccountsStore, projectsStore, project });
    // Mock notifications
    notificationMock.displayError = jest.fn(x => x);
    notificationMock.displaySuccess = jest.fn(x => x);
  });

  it('should update the project', async () => {
    // BUILD
    const store = {
      updateProject: jest.fn(),
    };
    component.getStore = jest.fn(() => {
      return store;
    });

    // OPERATE
    await component.handleClickSubmitButton();

    // CHECK
    expect(store.updateProject).toHaveBeenCalledWith(project);
    expect(notificationMock.displaySuccess).toHaveBeenCalledWith('Updated project successfully');
  });

  it('should fail to update the project', async () => {
    // BUILD
    const newProject = {
      id: 'a-new-project',
    };
    const error = {
      message: 'failed to update',
    };
    const store = {
      updateProject: jest.fn(() => {
        throw error;
      }),
    };
    component.getStore = jest.fn(() => {
      return store;
    });

    component.updateProject = newProject;

    // OPERATE
    await component.handleClickSubmitButton();

    // CHECK
    expect(store.updateProject).toHaveBeenCalledWith(newProject);
    expect(notificationMock.displayError).toHaveBeenCalledWith(error);
  });
});
