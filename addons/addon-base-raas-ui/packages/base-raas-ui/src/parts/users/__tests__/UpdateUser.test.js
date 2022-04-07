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
import UpdateUser from '../UpdateUser';

jest.mock('@amzn/base-ui/dist/helpers/notification');
const displayErrorMock = require('@amzn/base-ui/dist/helpers/notification');

jest.mock('../../../models/forms/UserFormUtils');
const userFormUtilsMock = require('../../../models/forms/UserFormUtils');

const projectsStore = {};
const userRolesStore = {
  isInternalUser: jest.fn(val => val === 'internalUser'),
  isInternalGuest: jest.fn(val => val === 'internalGuest'),
};
const userStore = {
  user: {
    displayName: 'placeholder',
  },
  load: jest.fn(),
};
const usersStore = {
  updateUser: jest.fn(),
  addUser: jest.fn(),
  deleteUser: jest.fn(),
};
const awsAccountsStore = {};
const authenticationProviderConfigsStore = {};

describe('UpdateUser', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // Mock display functions because they don't function correctly in enzyme
    displayErrorMock.displayError = jest.fn(x => x);
    displayErrorMock.displaySuccess = jest.fn(x => x);
  });

  it('should fail because non-admins cannot update identityProviderName', async () => {
    // BUILD
    // Render component
    wrapper = shallow(
      <UpdateUser.wrappedComponent
        projectsStore={projectsStore}
        userRolesStore={userRolesStore}
        userStore={userStore}
        usersStore={usersStore}
        awsAccountsStore={awsAccountsStore}
        authenticationProviderConfigsStore={authenticationProviderConfigsStore}
        adminMode={false}
      />,
    );
    // Get instance of the component
    component = wrapper.instance();

    const user = {
      username: 'username',
      firstName: 'fName',
      lastName: 'lName',
      email: 'email@example.com',
      userRole: 'internalUser',
      status: 'active',
    };
    const form = {
      values: jest.fn(() => user),
      $: jest.fn(() => {
        return {
          isDirty: true,
        };
      }),
      clear: jest.fn(),
    };

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(usersStore.updateUser).not.toHaveBeenCalledWith(user);
    expect(displayErrorMock.displayError).toHaveBeenCalledWith(
      'Only admins can update identity provider information for the user',
    );
  });

  it('should succeed to update without saving projectId values', async () => {
    // BUILD

    // Render component
    wrapper = shallow(
      <UpdateUser.wrappedComponent
        projectsStore={projectsStore}
        userRolesStore={userRolesStore}
        userStore={userStore}
        usersStore={usersStore}
        awsAccountsStore={awsAccountsStore}
        authenticationProviderConfigsStore={authenticationProviderConfigsStore}
        adminMode={false}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    const user = {
      username: 'newer_username',
      firstName: 'hName',
      lastName: 'nName',
      email: 'gockn@example.com',
      userRole: 'internalGuest',
      status: 'active',
      projectId: ['potatoface'],
    };

    const form = {
      values: jest.fn(() => user),
      $: jest.fn(() => {
        return {
          isDirty: false,
        };
      }),
      clear: jest.fn(),
    };

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(usersStore.updateUser).not.toHaveBeenCalledWith(expect.objectContaining({ projectId: user.projectId }));
    expect(displayErrorMock.displaySuccess).toHaveBeenCalledWith('Updated user successfully');
    expect(userStore.load).toHaveBeenCalled();
  });

  it('should update by deleting current user and adding a new one', async () => {
    // BUILD
    const user = {
      username: 'newest_username',
      firstName: 'iName',
      lastName: 'oName',
      email: 'hpdlo@example.com',
      userRole: 'internalUser',
      status: 'active',
      projectId: ['potatopancake'],
      isRootUser: false,
    };

    const form = {
      values: jest.fn(() => user),
      $: jest.fn(() => {
        return {
          isDirty: true,
        };
      }),
      clear: jest.fn(),
    };

    userFormUtilsMock.toIdpFromValue = jest.fn(() => {
      return {
        idpName: 'example',
        authNProviderId: 'example2',
      };
    });

    // Render component
    wrapper = shallow(
      <UpdateUser.wrappedComponent
        projectsStore={projectsStore}
        userRolesStore={userRolesStore}
        userStore={userStore}
        usersStore={usersStore}
        awsAccountsStore={awsAccountsStore}
        authenticationProviderConfigsStore={authenticationProviderConfigsStore}
        adminMode
        user={user}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(usersStore.addUser).toHaveBeenCalledWith(expect.objectContaining({ projectId: user.projectId }));
    expect(usersStore.deleteUser).toHaveBeenCalledWith(user);
    expect(displayErrorMock.displaySuccess).toHaveBeenCalledWith('Updated user successfully');
    expect(userStore.load).toHaveBeenCalled();
  });

  it('should fail because of an error being thrown during update', async () => {
    // BUILD

    // Render component
    wrapper = shallow(
      <UpdateUser.wrappedComponent
        projectsStore={projectsStore}
        userRolesStore={userRolesStore}
        userStore={userStore}
        usersStore={usersStore}
        awsAccountsStore={awsAccountsStore}
        authenticationProviderConfigsStore={authenticationProviderConfigsStore}
        adminMode={false}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    const user = {
      username: 'new_username',
      firstName: 'gName',
      lastName: 'mName',
      email: 'fnbjm@example.com',
      userRole: 'internalUser',
      status: 'active',
    };

    const check = {
      email: 'fnbjm@example.com',
      firstName: 'gName',
      lastName: 'mName',
    };
    const error = { message: 'cannot update' };
    const form = {
      values: jest.fn(() => user),
      $: jest.fn(() => {
        return {
          isDirty: false,
        };
      }),
      clear: jest.fn(() => {
        throw error;
      }),
    };

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    // tries to update
    expect(usersStore.updateUser).toHaveBeenCalledWith(check);
    // fails on form.clear()
    expect(displayErrorMock.displayError).toHaveBeenCalledWith(error);
  });
});
