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
// import { types } from 'mobx-state-tree';

// Mock buttons to avoid error
jest.mock('../parts/ScEnvironmentButtons');
const displayScEnvironmentButtons = require('../parts/ScEnvironmentButtons');

const ScEnvironmentCard = require('../ScEnvironmentCard');
// import ScEnvironmentCard from '../ScEnvironmentCard';

jest.mock('@aws-ee/base-ui/dist/helpers/notification');
const displayErrorMock = require('@aws-ee/base-ui/dist/helpers/notification');

const environment = {
  id: 'id',
  rev: 2,
  status: 'active',
  description: 'sample description',
  envTypeConfigId: 'env type config id',
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
// const KeyValuePair = types.model('KeyValuePair', {
//   key: '',
//   value: '',
// });

const environmentsStore = {
  getEnvTypeConfigsStore: jest.fn(),
};

describe('ScEnvironmentCard', () => {
  let component = null;
  let wrapper = null;
  beforeEach(() => {
    // render component
    wrapper = shallow(
      <ScEnvironmentCard.WrappedComponent scEnvironment={environment} envTypesStore={environmentsStore} />,
    );

    // get instance of component
    component = wrapper.instance();

    // mock error function because it doesn't function properly in enzyme
    displayErrorMock.displayError = jest.fn(x => x);
  });

  it('should print', async () => {
    console.log('Did not break');
  });

//   it('should get env type configs store', async () => {
//     // BUILD

//     // OPERATE
//     component.getEnvTypeConfigsStore();

//     // CHECK
//     expect(environmentsStore.getEnvTypeConfigsStore).toHaveBeenCalledWith(environment.envTypeId);
//   });

//   it('should get configuration', async () => {
//     // BUILD
//     // const configsStore =
//     // component.getEnvTypeConfigsStore.mockImplementation(() => {

//     // })

//     // OPERATE
//     component.getConfiguration(environment.envTypeConfigId);

//     // CHECK
//     expect(component.getEnvTypeConfigsStore).toHaveBeenCalled();
//     expect(component.getEnvTypeConfigsStore.getEnvTypeConfig).toHaveBeenCalledWith(environment.envTypeConfigId);
//   });

//   it('should get instance type from config params', async () => {
//     // BUILD
//     const config = new Proxy([new KeyValuePair('InstanceType', 't3.large')]);

//     // OPERATE
//     const instanceType = component.getInstanceTypeFromConfigParams(config);

//     // CHECK
//     expect(instanceType).not.toBe('Not available');
//   });

//   it('should display something graceful when no InstanceType param in config params', async () => {
//     // BUILD
//     const config = new Proxy([new KeyValuePair('name', 'name')]);

//     // OPERATE
//     const instanceType = component.getInstanceTypeFromConfigParams(config);

//     // CHECK
//     expect(instanceType).toBe('Not available');
//   });

//   it('should render detail table properly', async () => {
//     // BUILD

//     // OPERATE
//     component.renderDetailTable(environment);

//     // CHECK
//     expect(component.getConfiguration).toHaveBeenCalledWith(environment.envTypeConfigId);
//     expect(component.getInstanceTypeFromConfigParams).toHaveBeenCalled();
//   });
});
