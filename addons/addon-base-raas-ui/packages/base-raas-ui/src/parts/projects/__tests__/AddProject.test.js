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

import React from 'react';
import { shallow } from 'enzyme';
import AddProject from '../AddProject';

const usersStore = {
  asDropDownOptions: () => [
    {
      key: 'userABC',
      value: 'userABC',
      text: 'Dr. John Doe',
    },
  ],
};

const indexesStore = {
  dropdownOptions: [
    {
      key: '1',
      value: '123',
      text: 'Index 123',
    },
  ],
};

const projectsStore = {
  addProject: jest.fn(),
};

describe('AddProject', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // Render AddProject component
    wrapper = shallow(
      <AddProject.WrappedComponent indexesStore={indexesStore} projectsStore={projectsStore} usersStore={usersStore} />,
    );

    // Get instance of the component
    component = wrapper.instance();

    // Mock goto function
    component.goto = jest.fn();
  });

  it('should give an error if indexId is not present', async () => {
    // Set project attributes, except indexId
    component.project.id = 'my-research-project';
    component.project.description = 'Some relevant description';
    component.project.projectAdmins = ['userABC'];

    // Submit form
    await component.handleSubmit();

    // Verify an error is displayed
    const errors = component.validationErrors.errors;
    expect(errors.indexId).toBeDefined();
    expect(errors.indexId).toContain('The indexId field is required.');
  });

  it('should not give an error if indexId is provided', async () => {
    // Set project attributes
    component.project.id = 'my-research-project';
    component.project.description = 'Some relevant description';
    component.project.projectAdmins = ['userABC'];

    // Also set indexId, which is in the component state for some reason
    wrapper.setState({ indexId: '123' });

    // Submit form
    await component.handleSubmit();

    // Verify addProject gets invoked
    expect(component.validationErrors.errors).not.toBeDefined();
    expect(projectsStore.addProject).toHaveBeenCalled();
    expect(component.goto).toHaveBeenCalledWith('/accounts');
  });
});
