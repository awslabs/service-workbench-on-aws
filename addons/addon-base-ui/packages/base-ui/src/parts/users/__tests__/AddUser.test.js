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
import AddUser from '../AddUser';

jest.mock('../../../helpers/notification');
const notifMock = require('../../../helpers/notification');

const userStore = {};
const usersStore = {};

describe('AddUser', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // Render component
    wrapper = shallow(<AddUser.WrappedComponent userStore={userStore} usersStore={usersStore} />);

    // Get instance of the component
    component = wrapper.instance();

    // mock functions
    component.goto = jest.fn();
    notifMock.displayError = jest.fn(x => x);
  });

  it('should fail because the user did not provide password or last name', async () => {
    // BUILD
    const user = {
      username: 'dschrute',
      email: 'dschrute@example.com',
      firstName: 'Dwight',
    };

    component.user = user;
    // OPERATE
    await component.handleSubmit();

    // CHECK
    const errors = component.validationErrors.errors;
    expect(Object.keys(errors).length).toBe(2);
    expect(errors.password).toContain('The password field is required.');
    expect(errors.lastName).toContain('The lastName field is required.');
  });

  it('should fail because the store threw an error', async () => {
    // BUILD
    const user = {
      username: 'mscott',
      email: 'mscott@example.com',
      password: 'threat_level_midnight',
      firstName: 'Michael',
      lastName: 'Scarn',
    };
    const error = { message: 'cannot add user' };
    const badStore = {
      addUser: jest.fn(() => {
        throw error;
      }),
    };
    component.getStore = jest.fn(() => {
      return badStore;
    });

    component.user = user;
    // OPERATE
    await component.handleSubmit();

    // CHECK
    expect(badStore.addUser).toHaveBeenCalledWith(user);
    expect(notifMock.displayError).toHaveBeenCalledWith(error);
  });

  it('should add the user', async () => {
    // BUILD
    const user = {
      username: 'jhalpert',
      email: 'jhalpert@example.com',
      password: 'jim&pam<3',
      firstName: 'Jim',
      lastName: 'Halpert',
    };
    const goodStore = {
      addUser: jest.fn(),
    };
    component.getStore = jest.fn(() => {
      return goodStore;
    });

    component.user = user;
    // OPERATE
    await component.handleSubmit();

    // CHECK
    expect(goodStore.addUser).toHaveBeenCalledWith(user);
    expect(component.goto).toHaveBeenCalledWith('/users');
    expect(notifMock.displayError).not.toHaveBeenCalled();
  });
});
