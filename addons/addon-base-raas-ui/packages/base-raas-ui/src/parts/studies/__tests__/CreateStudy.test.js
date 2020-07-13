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
import CreateStudy from '../CreateStudy';

jest.mock('@aws-ee/base-ui/dist/helpers/notification');
const displayErrorMock = require('@aws-ee/base-ui/dist/helpers/notification');

const userStore = {
  asDropDownOptions: () => [
    {
      key: 'userABC',
      value: 'userABC',
      text: 'Dr. John Doe',
    },
  ],
  projectIdDropdown: ['proj1', 'proj2'],
};

const studiesStore = {
  createStudy: jest.fn(),
};

const studiesStoresMap = {
  'my-studies': studiesStore,
  'open-data': studiesStore,
  'organization': studiesStore,
};

describe('CreateStudy', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // Render component
    wrapper = shallow(<CreateStudy.wrappedComponent userStore={userStore} studiesStoresMap={studiesStoresMap} />);

    // Get instance of the component
    component = wrapper.instance();

    // mock displayError because toastr cant function properly in a wrappedComponent setting
    displayErrorMock.displayError = jest.fn(err => {
      throw err;
    });
  });

  it('should try to create a study based on form input', async () => {
    // BUILD
    const form = {
      values() {
        return {
          categoryId: 'my-studies',
        };
      },
      clear: jest.fn(),
    };

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(studiesStore.createStudy).toHaveBeenCalledWith({ category: 'My Studies' });
    expect(form.clear).toHaveBeenCalled();
  });

  it('should fail if the categoryId is not valid or missing', async () => {
    // BUILD
    const form = {
      values() {
        return {};
      },
      clear: jest.fn(),
    };

    // OPERATE
    try {
      await component.handleFormSubmission(form);
      expect.hasAssertions();
    } catch (err) {
      expect(displayErrorMock.displayError).toHaveBeenCalled();
      expect(err.message).toEqual("Cannot read property 'createStudy' of undefined");
    }
  });
});
