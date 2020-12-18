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
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Message } from 'semantic-ui-react';

// expected props
// - study (via props)
// - onCancel (via props) a call back function when the user clicks on Done
class StudyStatusMessage extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.expanded = false;
    });
  }

  get study() {
    return this.props.study;
  }

  handleExpand = () => {
    this.expanded = !this.expanded;
  };

  handleCancel = () => {
    if (!_.isFunction(this.props.onCancel)) return;
    this.props.onCancel();
  };

  render() {
    return (
      <div className="mt2 mb2 animated fadeIn">
        {this.renderAvailable()}
        {this.renderPending()}
        {this.renderError()}
      </div>
    );
  }

  renderAvailable() {
    const study = this.study;

    if (!study.reachableState) return null;

    return (
      <Message positive onDismiss={this.handleCancel}>
        <Message.Header>Available</Message.Header>
        <p>The study is reachable and available for use.</p>
      </Message>
    );
  }

  renderPending() {
    const study = this.study;
    const expanded = this.expanded;
    const expandText = expanded ? 'less' : 'more';
    const msg = study.statusMessageInfo.message;

    if (!study.pendingState) return null;

    return (
      <Message warning>
        <Message.Header>Not available yet</Message.Header>
        <p>
          The study is in the process of being connected with the application. It is unreachable until the
          CloudFormation stack is successfully deploy.
          <span className="underline ml1 cursor-pointer" onClick={this.handleExpand}>
            {expandText}
          </span>
        </p>
        {expanded && (
          <div className="mt2 animated fadeIn">
            <Message.Header>CloudFormation stack already deployed?</Message.Header>
            <Message.List>
              <Message.Item>Check if the CloudFormation stack is deployed in the correct AWS account</Message.Item>
              <Message.Item>Check if the CloudFormation stack is deployed in the correct AWS region</Message.Item>
              <Message.Item>Try the connection check test again</Message.Item>
            </Message.List>
          </div>
        )}
        {expanded && !_.isEmpty(msg) && (
          <div className="mt2">
            <Message.Header>Message received from the server</Message.Header>
            <p>{msg}</p>
          </div>
        )}
      </Message>
    );
  }

  renderError() {
    const study = this.study;
    const expanded = this.expanded;
    const expandText = expanded ? 'less' : 'more';
    const msg = study.statusMessageInfo.message;

    if (!study.errorState) return null;

    return (
      <Message negative>
        <Message.Header>Not available</Message.Header>
        <p>
          The study is unreachable. This is usually an indication of a problem during the CloudFormation stack
          deployment.
          <span className="underline ml1 cursor-pointer" onClick={this.handleExpand}>
            {expandText}
          </span>
        </p>
        {expanded && (
          <Message.List>
            <Message.Item>Check if the CloudFormation stack is deployed in the correct AWS account</Message.Item>
            <Message.Item>Check if the CloudFormation stack is deployed in the correct AWS region</Message.Item>
            <Message.Item>Try the connection check test again</Message.Item>
          </Message.List>
        )}
        {expanded && !_.isEmpty(msg) && (
          <div className="mt2">
            <Message.Header>Message received from the server</Message.Header>
            <p>{msg}</p>
          </div>
        )}
      </Message>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(StudyStatusMessage, {
  study: computed,
  expanded: observable,
  handleExpand: action,
  handleCancel: action,
});

export default inject()(withRouter(observer(StudyStatusMessage)));
