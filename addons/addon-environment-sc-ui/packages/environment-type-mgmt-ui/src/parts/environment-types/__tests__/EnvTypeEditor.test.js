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
import EnvTypeEditor from '../EnvTypeEditor';

jest.mock('@amzn/base-ui/dist/helpers/routing');
const gotoMock = require('@amzn/base-ui/dist/helpers/routing');

const envTypeCandidatesStore = {};
const envTypesStore = {
  getEnvType: jest.fn(),
};
const match = {
  params: {},
};
describe('EnvTypeEditor', () => {
  it('should render successfully', async () => {
    const goTo = jest.fn();
    gotoMock.gotoFn = jest.fn(() => {
      return goTo;
    });

    const wrapper = shallow(
      <EnvTypeEditor.WrappedComponent
        envTypeCandidatesStore={envTypeCandidatesStore}
        envTypesStore={envTypesStore}
        match={match}
      />,
    );

    const component = wrapper.instance();
    await component.handleDone();

    expect(wrapper).toBeDefined();
    expect(goTo).toHaveBeenCalledWith(`/workspace-types-management`);
  });
});
