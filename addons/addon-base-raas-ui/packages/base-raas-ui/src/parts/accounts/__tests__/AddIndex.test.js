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
import AddIndex from '../AddIndex';

const usersStore = {
  asDropDownOptions: () => [
    {
      key: 'userABC',
      value: 'userABC',
      text: 'Dr. John Doe',
    },
  ],
};

const awsAccountsStore = {
  dropdownOptions: [
    {
      key: '1',
      value: '123',
      text: 'Index 123',
    },
  ],
};

const indexesStore = {
  addIndex: jest.fn(),
};

describe('AddIndex', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // Render AddIndex component
    wrapper = shallow(
      <AddIndex.WrappedComponent
        indexesStore={indexesStore}
        usersStore={usersStore}
        awsAccountsStore={awsAccountsStore}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    // Mock goto function
    component.goto = jest.fn();
  });

  it('should give an error if accountId is not present', async () => {
    // Set index attributes, except awsAccountId
    component.index.id = 'index-123';
    component.index.description = 'Some relevant description';

    // Submit form
    await component.handleSubmit();

    // Verify an error is displayed
    const errors = component.validationErrors.errors;
    expect(errors.awsAccountId).toBeDefined();
    expect(errors.awsAccountId).toContain('The awsAccountId field is required.');
  });

  it('should not give an error if accountId is provided', async () => {
    // Set index attributes
    component.index.id = 'index-123';
    component.index.description = 'Some relevant description';

    // Also set indexId, which is in the component state for some reason
    wrapper.setState({ awsAccountId: 'abc' });

    // Submit form
    await component.handleSubmit();

    // Verify addIndex gets invoked
    expect(component.validationErrors.errors).not.toBeDefined();
    expect(indexesStore.addIndex).toHaveBeenCalled();
    expect(component.goto).toHaveBeenCalledWith('/accounts');
  });
});
