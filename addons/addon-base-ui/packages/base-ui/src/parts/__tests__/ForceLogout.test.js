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
import { Button, Modal } from 'semantic-ui-react';
import ForceLogout from '../ForceLogout';

const AuthenticationProviderConfigsStore = { logout: jest.fn() };
const app = { userAuthenticated: true };
describe('ForceLogout', () => {
  let wrapper = null;
  let renderModalSnapshot = null;
  let renderSnapshot = null;
  beforeAll(() => {
    wrapper = shallow(<ForceLogout.wrappedComponent authentication={AuthenticationProviderConfigsStore} app={app} />);
    const component = wrapper.instance();
    component.tokenActive = false;
    renderModalSnapshot = (
      <>
        <Modal open={component.modalOpen} closeOnEscape={false} closeOnDimmerClick={false} centered={false}>
          <Modal.Header>Session expired</Modal.Header>
          <Modal.Content className="center">
            <div>Your session has expired. Close Service Workbench and log in again.</div>
          </Modal.Content>
          <Modal.Actions className="clearfix">
            <Button floated="right" content="Log Out" onClick={component.handleLogout} />
          </Modal.Actions>
        </Modal>
      </>
    );
    renderSnapshot = (
      <>
        <>
          <Modal open={component.modalOpen} closeOnEscape={false} closeOnDimmerClick={false} centered={false}>
            <Modal.Header>Session expired</Modal.Header>
            <Modal.Content className="center">
              <div>Your session has expired. Close Service Workbench and log in again.</div>
            </Modal.Content>
            <Modal.Actions className="clearfix">
              <Button floated="right" content="Log Out" onClick={component.handleLogout} />
            </Modal.Actions>
          </Modal>
        </>
      </>
    );
  });

  it('should exist', () => {
    expect(ForceLogout).not.toBeNull();
    expect(ForceLogout.displayName).toBe('inject-with-authentication-app(ForceLogout)');
  });

  it('should make renderModal return null when tokenActive is true', () => {
    const component = wrapper.instance();
    component.tokenActive = true;
    expect(component.renderModal()).toEqual(null);
  });

  it('should make renderModal return modal when tokenActive is false', () => {
    const component = wrapper.instance();
    component.tokenActive = false;
    expect(component.renderModal()).toEqual(renderModalSnapshot);
  });

  it('should make render return modal when user is authenticated', () => {
    const component = wrapper.instance();
    expect(component.render()).toEqual(renderSnapshot);
  });

  it('should make render return null when user is not authenticated', () => {
    const userAuth = { userAuthenticated: false };
    const tempWrapper = shallow(
      <ForceLogout.wrappedComponent authentication={AuthenticationProviderConfigsStore} app={userAuth} />,
    );
    const component = tempWrapper.instance();
    expect(component.render()).toEqual(null);
    clearInterval(component.timer);
  });

  afterAll(async () => {
    const component = wrapper.instance();
    clearInterval(component.timer);
  });
});
