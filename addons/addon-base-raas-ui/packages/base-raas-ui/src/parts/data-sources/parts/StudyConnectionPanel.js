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
import { decorate, computed, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Progress } from 'semantic-ui-react';

import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import StudyStatusMessage from './StudyStatusMessage';

// expected props
// - onCancel (via props) a call back function when the user clicks on Done
// - study (via props)
// - operation (via props)
class StudyConnectionPanel extends React.Component {
  get study() {
    return this.props.study;
  }

  get operation() {
    return this.props.operation;
  }

  get progress() {
    return this.operation.progress;
  }

  handleCancel = () => {
    if (!_.isFunction(this.props.onCancel)) return;
    this.props.onCancel();
  };

  render() {
    return (
      <div className="mt2 mb2 animated fadeIn">
        {this.renderError()}
        {this.renderProcessing()}
        {this.renderMessage()}
      </div>
    );
  }

  renderProcessing() {
    const operation = this.operation;
    const processing = operation.processing;
    if (!processing) return null;
    return (
      <div className="mb3">
        <Progress percent={100} active>
          Checking Connection
        </Progress>
      </div>
    );
  }

  renderError() {
    const operation = this.operation;
    const processing = operation.processing;
    if (processing) return null;

    if (!operation.hasError) return null;
    return <ErrorBox error={operation.error} className="p0 mb2" onCancel={this.handleCancel} />;
  }

  renderMessage() {
    const operation = this.operation;
    const study = this.study;
    const processing = operation.processing;

    if (processing) return null;
    if (operation.hasError) return null;

    return <StudyStatusMessage study={study} onCancel={this.handleCancel} />;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(StudyConnectionPanel, {
  study: computed,
  operation: computed,
  progress: computed,
  handleCancel: action,
});

export default inject()(withRouter(observer(StudyConnectionPanel)));
