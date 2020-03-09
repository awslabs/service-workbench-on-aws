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
import { observable, action, decorate, runInAction, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Header } from 'semantic-ui-react';
import IdleTimer from 'react-idle-timer';

import { autoLogoutTimeoutInMinutes } from '../helpers/settings';

// expected props
// - authentication
// - app
class AutoLogout extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.dialogCountDown = undefined;
      this.intervalId = undefined;
    });
  }

  get app() {
    return this.props.app;
  }

  get authentication() {
    return this.props.authentication;
  }

  get modalOpen() {
    return this.dialogCountDown >= 0;
  }

  componentDidMount() {}

  clearInterval() {
    if (!_.isUndefined(this.intervalId)) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.dialogCountDown = undefined;
  }

  startDialogCountDown = () => {
    if (!_.isUndefined(this.intervalId)) return;
    this.dialogCountDown = 60;

    this.intervalId = setInterval(async () => {
      // eslint-disable-next-line consistent-return
      runInAction(() => {
        if (this.dialogCountDown <= 0) {
          return this.doLogout();
        }
        this.dialogCountDown -= 1;
      });
    }, 1000);
  };

  cancelDialogCountDown = () => {
    this.clearInterval();
  };

  doLogout = async () => {
    this.clearInterval();
    return this.authentication.logout({ autoLogout: true });
  };

  handleLogout = async event => {
    event.preventDefault();
    event.stopPropagation();
    return this.doLogout();
  };

  render() {
    const authenticated = this.app.userAuthenticated;
    if (!authenticated) return null;
    return (
      <>
        <IdleTimer timeout={1000 * 60 * autoLogoutTimeoutInMinutes} onIdle={this.startDialogCountDown} />
        <Modal open={this.modalOpen} closeOnEscape={false} closeOnDimmerClick={false} centered={false}>
          <Modal.Header>Are you still there?</Modal.Header>
          <Modal.Content className="center">
            <div>For security purposes, you will be logged out in</div>
            <Header as="h1">{this.dialogCountDown}</Header>
            <div>seconds</div>
          </Modal.Content>
          <Modal.Actions className="clearfix">
            <Button floated="right" primary content="Keep Me Logged In" onClick={this.cancelDialogCountDown} />
            <Button floated="right" content="Log Out" onClick={this.handleLogout} />
          </Modal.Actions>
        </Modal>
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AutoLogout, {
  app: computed,
  authentication: computed,
  modalOpen: computed,
  intervalId: observable,
  dialogCountDown: observable,
  startDialogCountDown: action,
  doLogout: action,
  handleLogout: action,
  cancelDialogCountDown: action,
  clearInterval: action,
});

export default inject('authentication', 'app')(observer(AutoLogout));
