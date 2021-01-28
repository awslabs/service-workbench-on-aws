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
import StudiesPage from '../StudiesPage';

global.window = {
  scrollTo: jest.fn(),
};

const match = {
  params: {},
};

const studiesStoresMap = {};

const filesSelectionEmpty = {
  empty: true,
  count: 10,
};

const filesSelectionFull = {
  empty: false,
  count: 10,
};

describe('StudiesPage', () => {
  let component = null;
  let wrapper = null;

  it('should allow the user to select a study', async () => {
    // Render component
    const userStore = {
      user: {
        capabilities: null,
      },
    };

    wrapper = shallow(
      <StudiesPage.WrappedComponent
        userStore={userStore}
        studiesStoresMap={studiesStoresMap}
        filesSelection={filesSelectionEmpty}
        match={match}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    // mock functions
    component.renderWarningWithButton = jest.fn(x => x);

    // OPERATE
    const res = await component.renderSelection();

    // CHECK
    expect(res.content).toHaveProperty(
      ['props', 'children', 0],
      expect.stringContaining('Select one or more studies to proceed'),
    );
    expect(component.renderWarningWithButton).toHaveBeenCalled();
  });

  it('should warn the user they do not have projects', async () => {
    // Render component
    const userStore = {
      user: {
        capabilities: null,
        hasProjects: false,
      },
    };

    wrapper = shallow(
      <StudiesPage.WrappedComponent
        userStore={userStore}
        studiesStoresMap={studiesStoresMap}
        filesSelection={filesSelectionEmpty}
        match={match}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    // mock functions
    component.renderWarning = jest.fn(x => x);
    component.renderWarningWithButton = jest.fn(x => x);

    // OPERATE
    await component.renderSelection();

    // CHECK
    expect(component.renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'Missing association with one or more projects!',
      }),
    );
  });

  it('should display the studies to the user without warnings', async () => {
    // Render component
    const userStore = {
      user: {
        capabilities: null,
      },
    };

    wrapper = shallow(
      <StudiesPage.WrappedComponent
        userStore={userStore}
        studiesStoresMap={studiesStoresMap}
        filesSelection={filesSelectionFull}
        match={match}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    // mock functions
    component.renderWarning = jest.fn(x => x);
    component.renderWarningWithButton = jest.fn(x => x);

    // OPERATE
    const res = await component.renderSelection();

    // CHECK
    expect(res.props.className).toBe('clearfix');
    expect(component.renderWarning).not.toHaveBeenCalled();
    expect(component.renderWarningWithButton).not.toHaveBeenCalled();
  });
});
