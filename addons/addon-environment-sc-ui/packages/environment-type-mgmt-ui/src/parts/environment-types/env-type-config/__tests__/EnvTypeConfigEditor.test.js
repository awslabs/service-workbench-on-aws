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
import EnvTypeConfigEditor from '../EnvTypeConfigEditor';

jest.mock('@aws-ee/base-ui/dist/helpers/notification');
const displayErrorMock = require('@aws-ee/base-ui/dist/helpers/notification');

const envTypeConfigsStore = {
  ready: true,
  updateEnvTypeConfig: jest.fn(),
};

const userRolesStore = {
  ready: true,
};

const envTypeConfig = {
  id: 'example_id',
  name: 'exampleName',
};

const onEnvTypeConfigSaveComplete = jest.fn();

describe('EnvTypeConfigEditor', () => {
  let wrapper = null;
  let component = null;

  beforeEach(() => {
    // render component
    wrapper = shallow(
      // eslint-disable-next-line react/jsx-pascal-case
      <EnvTypeConfigEditor.wrappedComponent
        envTypeConfigsStore={envTypeConfigsStore}
        userRolesStore={userRolesStore}
        envTypeConfig={envTypeConfig}
        onEnvTypeConfigSaveComplete={onEnvTypeConfigSaveComplete}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();
    component.isEditAction = jest.fn(() => true);

    // Mock display functions because they don't function correctly in enzyme
    displayErrorMock.displayError = jest.fn(x => x);
    displayErrorMock.displaySuccess = jest.fn(x => x);
  });

  it('should update the environment config', async () => {
    // BUILD
    const ret = { name: 'some_new_name' };
    const form = {
      values: jest.fn(() => {
        return ret;
      }),
    };

    // OPERATE
    await component.handleFormSubmission(form);
    // CHECK
    expect(envTypeConfigsStore.updateEnvTypeConfig).toHaveBeenCalledWith(expect.objectContaining(ret));
    expect(onEnvTypeConfigSaveComplete).toHaveBeenCalled();
    expect(displayErrorMock.displaySuccess).toHaveBeenCalledWith(`Successfully updated ${ret.name} configuration`);
  });

  it('should catch the error successfully', async () => {
    // BUILD
    const ret = { name: 'a_weird_name' };
    const form = {
      values: jest.fn(() => {
        return ret;
      }),
    };
    const error = { message: 'oh no! An error!' };
    envTypeConfigsStore.updateEnvTypeConfig.mockImplementationOnce(() => {
      throw error;
    });

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(displayErrorMock.displayError).toHaveBeenCalledWith(error);
  });
});
