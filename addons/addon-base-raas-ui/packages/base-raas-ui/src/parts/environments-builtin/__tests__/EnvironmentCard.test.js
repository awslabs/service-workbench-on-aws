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
import EnvironmentCard from '../EnvironmentCard';

jest.mock('@aws-ee/base-ui/dist/helpers/notification');
const displayErrorMock = require('@aws-ee/base-ui/dist/helpers/notification');

jest.mock('../../../../images/marketplace/sagemaker-notebook-icon.svg');

const environment = {
  name: 'name',
  description: 'descrip goes here',
  createdAt: '01-01-1900',
  createdBy: 'anonymous',
  fetchingUrl: 'example.com',
  status: 'active',
  instanceInfo: {
    type: 'sagemaker',
  },
  sharedWithUsers: {},
  projectId: 'projId',
  setFetchingUrl: jest.fn(),
  isExternal: false,
};
const environmentsStore = {
  startEnvironment: jest.fn(),
  stopEnvironment: jest.fn(),
};
const userDisplayName = {
  getLongDisplayName: jest.fn(() => 'longDisplayName'),
};
const event = {
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
};

describe('EnvironmentCard', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // render component
    wrapper = shallow(
      <EnvironmentCard.WrappedComponent
        environmentsStore={environmentsStore}
        environment={environment}
        userDisplayName={userDisplayName}
      />,
    );

    // get instance of component
    component = wrapper.instance();

    // mock error function because it doesn't function properly in enzyme
    displayErrorMock.displayError = jest.fn(x => x);
  });

  it('should start the environment', async () => {
    // BUILD

    // OPERATE
    await component.handleStartEnvironment(event);

    // CHECK
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(environmentsStore.startEnvironment).toHaveBeenCalledWith(environment);
  });

  it('should stop the environment', async () => {
    // BUILD

    // OPERATE
    await component.handleStopEnvironment(event);

    // CHECK
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(environmentsStore.stopEnvironment).toHaveBeenCalledWith(environment);
  });

  it('should throw an error during stop environment', async () => {
    // BUILD
    const error = { message: 'failed to stop environment' };
    environmentsStore.stopEnvironment.mockImplementationOnce(() => {
      throw error;
    });
    // OPERATE
    await component.handleStopEnvironment(event);

    // CHECK
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(environmentsStore.stopEnvironment).toHaveBeenCalledWith(environment);
    expect(displayErrorMock.displayError).toHaveBeenCalledWith(error);
  });

  it('should throw an error during start environment', async () => {
    // BUILD
    const error = { message: 'failed to start environment' };
    environmentsStore.startEnvironment.mockImplementationOnce(() => {
      throw error;
    });
    // OPERATE
    await component.handleStartEnvironment(event);

    // CHECK
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(environmentsStore.startEnvironment).toHaveBeenCalledWith(environment);
    expect(displayErrorMock.displayError).toHaveBeenCalledWith(error);
  });
});
