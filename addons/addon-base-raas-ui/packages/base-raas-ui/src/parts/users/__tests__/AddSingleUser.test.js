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
import AddSingleUser from '../AddSingleUser';

jest.mock('@aws-ee/base-ui/dist/helpers/notification');
const displayErrorMock = require('@aws-ee/base-ui/dist/helpers/notification');

jest.mock('@aws-ee/base-ui/dist/helpers/routing');
const gotoMock = require('@aws-ee/base-ui/dist/helpers/routing');

const projectsStore = {};
const userRolesStore = {
  isInternalUser: jest.fn(val => val === 'internalUser'),
  isInternalGuest: jest.fn(val => val === 'internalGuest'),
};
const usersStore = {
  addUser: jest.fn(),
};
const userStore = {};
const awsAccountsStore = {};
const authenticationProviderConfigsStore = {};

describe('AddSingleLocalUser', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // Render component
    wrapper = shallow(
      <AddSingleUser.WrappedComponent
        projectsStore={projectsStore}
        userRolesStore={userRolesStore}
        usersStore={usersStore}
        userStore={userStore}
        awsAccountsStore={awsAccountsStore}
        authenticationProviderConfigsStore={authenticationProviderConfigsStore}
      />,
    );

    // Get instance of the component
    component = wrapper.instance();

    // Mock display functions because they don't function correctly in enzyme
    displayErrorMock.displayError = jest.fn(x => x);
    displayErrorMock.displaySuccess = jest.fn(x => x);

    // Mock goto function
    const goTofxn = jest.fn();
    gotoMock.gotoFn = jest.fn(() => goTofxn);
  });

  it('should throw an error', async () => {
    // BUILD
    const ret = {
      userRole: 'internalUser',
      identityProviderName:
        '{"authNProviderId": "https://cognito-idp.eu-west-3.amazonaws.com", "idpName": "Cognito Native Pool"}',
    };
    const error = { message: 'adding failed' };
    const form = {
      values: jest.fn(() => {
        return ret;
      }),
      clear: jest.fn(() => {
        throw error;
      }),
    };

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(displayErrorMock.displayError).toHaveBeenCalledWith(error);
  });

  it('should create an internal user with projectIds', async () => {
    const ret = {
      userRole: 'internalUser',
      projectId: ['potatoes'],
      identityProviderName:
        '{"authNProviderId": "https://cognito-idp.eu-west-3.amazonaws.com", "idpName": "Cognito Native Pool"}',
    };

    const form = {
      values: jest.fn(() => {
        return ret;
      }),
      clear: jest.fn(),
    };

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(displayErrorMock.displaySuccess).toHaveBeenCalledWith('Added user successfully');
    expect(displayErrorMock.displayError).not.toHaveBeenCalled();
    expect(usersStore.addUser).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: ret.projectId,
      }),
    );
  });

  it('should create a non-internal user without projectIds', async () => {
    const ret = {
      userRole: 'internalGuest',
      projectId: ['potatoes'],
      identityProviderName:
        '{"authNProviderId": "https://cognito-idp.eu-west-3.amazonaws.com", "idpName": "Cognito Native Pool"}',
    };

    const check = {
      userRole: ret.userRole,
      projectId: [],
      authenticationProviderId: 'https://cognito-idp.eu-west-3.amazonaws.com',
      identityProviderName: 'Cognito Native Pool',
    };

    const form = {
      values: jest.fn(() => {
        return ret;
      }),
      clear: jest.fn(),
    };

    // OPERATE
    await component.handleFormSubmission(form);

    // CHECK
    expect(displayErrorMock.displaySuccess).toHaveBeenCalledWith('Added user successfully');
    expect(displayErrorMock.displayError).not.toHaveBeenCalled();
    expect(usersStore.addUser).toHaveBeenCalledWith(check);
  });
});
