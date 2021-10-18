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

// Mock buttons to avoid error
jest.mock('../parts/ScEnvironmentButtons', () => ({
  __ScEnvironmentButtons: true,
}));
// eslint-disable-next-line import/first
import {} from '../parts/ScEnvironmentButtons';

// const ScEnvironmentCard = require('../ScEnvironmentCard');
// eslint-disable-next-line import/first
import ScEnvironmentCard from '../ScEnvironmentCard';

jest.mock('@aws-ee/base-ui/dist/helpers/notification');
const displayErrorMock = require('@aws-ee/base-ui/dist/helpers/notification');

const scEnvironment = {
  id: 'id',
  rev: 2,
  status: 'active',
  description: 'sample description',
  envTypeConfigId: 'existingConfigId',
  name: 'name',
  projectId: 'project id',
  envTypeId: 'env type id',
  createdAt: '01-01-1900',
  createdBy: 'anonymous',
  updatedAt: '01-02-1900',
  updatedBy: 'anonymous',
  error: 'error',
  connections: [],
  hasConnections: false,
  studyIds: [],
  cidr: [],
  outputs: [],
};

const scEnvConfig = {
  name: 'name',
  instanceType: 'instanceType',
};

const envTypesStore = {
  getEnvTypeConfigsStore: jest.fn(() => envTypesStore),
  load: jest.fn(),
  getEnvTypeConfig: jest.fn(envTypeConfigId => (envTypeConfigId === 'existingConfigId' ? scEnvConfig : undefined)),
};

describe('ScEnvironmentCard', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // render component
    wrapper = shallow(
      <ScEnvironmentCard.WrappedComponent scEnvironment={scEnvironment} envTypesStore={envTypesStore} />,
    );

    // get instance of component
    component = wrapper.instance();

    // mock error function because it doesn't function properly in enzyme
    displayErrorMock.displayError = jest.fn(x => x);
  });

  it('should get env type configs store', async () => {
    // BUILD, OPERATE
    component.getEnvTypeConfigsStore();

    // CHECK
    expect(envTypesStore.getEnvTypeConfigsStore).toHaveBeenCalledWith(scEnvironment.envTypeId);
  });

  it('should get configuration', async () => {
    // BUILD
    const spyOnConfigsStore = jest.spyOn(component, 'getEnvTypeConfigsStore');

    // OPERATE
    const config = component.getConfiguration(scEnvironment.envTypeConfigId);

    // CHECK
    expect(spyOnConfigsStore).toHaveBeenCalled();
    expect(envTypesStore.getEnvTypeConfig).toHaveBeenCalledWith(scEnvironment.envTypeConfigId);
    expect(config.name).toBeDefined();
    expect(config.instanceType).toBeDefined();
    expect(config).toEqual(scEnvConfig);
  });

  it('should get undefined configuration', async () => {
    // BUILD
    const spyOnConfigsStore = jest.spyOn(component, 'getEnvTypeConfigsStore');

    // OPERATE
    const config = component.getConfiguration('deletedConfigId');

    // CHECK
    expect(spyOnConfigsStore).toHaveBeenCalled();
    expect(envTypesStore.getEnvTypeConfig).toHaveBeenCalledWith('deletedConfigId');
    expect(config).toBeUndefined();
  });
});
