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

import _ from 'lodash';
import React from 'react';
import { observable, action, decorate, computed, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Button, Modal } from 'semantic-ui-react';

const jwtDecode = require('jwt-decode');

// expected props
// - authentication
// - app
class ForceLogout extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.tokenActive = true;
    });
  }

  get app() {
    return this.props.app;
  }

  get authentication() {
    return this.props.authentication;
  }

  get modalOpen() {
    return !this.tokenActive;
  }

  componentDidMount() {
    this.timer = setInterval(() => {
      const expirationInMins = this.hasTokenExpired();
      // eslint-disable-next-line react/no-unused-state
      if (expirationInMins > 0) {
        runInAction(() => {
          this.tokenActive = true;
        });
      } else {
        runInAction(() => {
          this.tokenActive = false;
        });
      }
    }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  doLogout = async () => {
    clearInterval(this.timer);
    return this.authentication.logout({ autoLogout: true });
  };

  hasTokenExpired = () => {
    let minutesRemaining;
    try {
      const idToken = localStorage.getItem('appIdToken');
      const decodedIdToken = jwtDecode(idToken);
      const expiresAt = _.get(decodedIdToken, 'exp', 0) * 1000;
      minutesRemaining = (expiresAt - Date.now()) / 60 / 1000;
    } catch (e) {
      minutesRemaining = -1;
    }
    return minutesRemaining < 0;
  };

  handleLogout = async event => {
    event.preventDefault();
    event.stopPropagation();
    return this.doLogout();
  };

  renderModal() {
    if (this.tokenActive) {
      return null;
    }
    return (
      <>
        <Modal open={this.modalOpen} closeOnEscape={false} closeOnDimmerClick={false} centered={false}>
          <Modal.Header>Session expired</Modal.Header>
          <Modal.Content className="center">
            <div>Your session has expired. Close Service Workbench and log in again.</div>
          </Modal.Content>
          <Modal.Actions className="clearfix">
            <Button floated="right" content="Log Out" onClick={this.handleLogout} />
          </Modal.Actions>
        </Modal>
      </>
    );
  }

  render() {
    const authenticated = this.app.userAuthenticated;
    if (!authenticated) return null;
    return <>{this.renderModal()}</>;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ForceLogout, {
  app: computed,
  authentication: computed,
  modalOpen: computed,
  tokenActive: observable,
  doLogout: action,
  handleLogout: action,
  clearInterval: action,
});

export default inject('authentication', 'app')(observer(ForceLogout));
