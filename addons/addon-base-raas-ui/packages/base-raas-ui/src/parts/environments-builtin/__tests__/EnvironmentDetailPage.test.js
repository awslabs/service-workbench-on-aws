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
import EnvironmentDetailPage from '../EnvironmentDetailPage';

const { generateKeyPairSync, publicEncrypt, constants } = require('crypto');

jest.mock('@amzn/base-ui/dist/helpers/notification');
const displayErrorMock = require('@amzn/base-ui/dist/helpers/notification');

jest.mock('@amzn/base-ui/dist/helpers/routing');
const gotoMock = require('@amzn/base-ui/dist/helpers/routing');

const environmentInstance = {
  name: 'name',
  id: 'id',
  createdAt: '01-01-1900',
  createdBy: 'anonymous',
  status: 'active',
  projectId: 'projId',
  isExternal: false,
  getWindowsPassword: jest.fn(),
};

const environmentStore = {
  load: jest.fn(),
  startHeartbeat: jest.fn(),
  ready: true,
  loading: true,
  environment: environmentInstance,
};

const environmentsStore = {
  getEnvironmentStore: jest.fn(() => environmentStore),
  updateEnvironment: jest.fn(),
};

const userStore = {};

const match = {
  params: {
    instanceId: 'placeholder',
  },
};
const event = {
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
};

describe('EnvironmentDetailPage', () => {
  let wrapper = null;
  let container = null;
  beforeEach(() => {
    // Render component
    wrapper = shallow(
      <EnvironmentDetailPage.WrappedComponent
        environmentsStore={environmentsStore}
        userStore={userStore}
        match={match}
      />,
    );
    // get instance of component
    container = wrapper.instance();

    // mock display error function
    displayErrorMock.displayError = jest.fn(x => x);

    // Mock goto function
    gotoMock.gotoFn = jest.fn(() => jest.fn());
  });

  it('should accept and decrypt the user password', async () => {
    // BUILD
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
    });
    const realPassword = 'APASSWORD';
    const passData = [
      { privateKey },
      {
        passwordData: publicEncrypt(
          { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
          Buffer.from(realPassword, 'utf8'),
        ),
      },
    ];
    environmentInstance.getWindowsPassword.mockImplementationOnce(() => passData);

    // OPERATE
    await container.handleWindowsPasswordRequest(event);

    // CHECK
    expect(container.windowsPassword).not.toEqual(passData.passwordData);
    expect(container.windowsPassword).toEqual(realPassword);
  });

  it('should update the sharedWithUsers field of the environment', async () => {
    // BUILD

    // OPERATE
    await container.handleSubmitSharedWithUsersClick(event);

    // CHECK
    expect(environmentsStore.updateEnvironment).toHaveBeenCalledWith(
      expect.objectContaining({ id: environmentInstance.id }),
    );
  });
});
