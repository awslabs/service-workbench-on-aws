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
import { Segment, Button, Icon, Header, Progress, Message } from 'semantic-ui-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

// expected props
// - wizard (via prop)
class SubmitStep extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  get operations() {
    return this.wizard.operations;
  }

  get running() {
    return this.operations.running;
  }

  get success() {
    return this.operations.success;
  }

  get failure() {
    return this.operations.failure;
  }

  get allFailed() {
    return this.operations.allFailed;
  }

  get wizard() {
    return this.props.wizard;
  }

  handleCancel = () => {
    const goto = gotoFn(this);
    this.wizard.reset();

    goto('/data-sources');
  };

  handleRetry = () => {
    swallowError(this.wizard.retry());
  };

  handleNext = () => {
    this.wizard.advanceToNextStep();
  };

  render() {
    return (
      <>
        <Header as="h3" icon textAlign="center" className="mt2" color="grey">
          Register Studies
        </Header>
        <Segment clearing className="p3">
          {this.renderContent()}
        </Segment>
      </>
    );
  }

  renderContent() {
    const operations = this.operations;
    const running = this.running;
    const success = this.success;
    const error = this.failure;

    return (
      <div className="animated fadeIn">
        <div>
          {running && (
            <Header className="mb3" as="h3" color="grey">
              Registering Studies
            </Header>
          )}
          {success && (
            <Header className="mb3" as="h3" color="grey">
              Successfully Registered Studies
            </Header>
          )}
          {error && (
            <Header className="mb3" as="h3" color="grey">
              Error Registering Studies
            </Header>
          )}
        </div>

        <div>
          {_.map(operations.ops, op => this.renderOperation(op))}
          {this.renderButtons()}
        </div>
      </div>
    );
  }

  renderFailedStepsWarning() {
    return (
      <Message warning>
        <Message.Header>Failures have occurred</Message.Header>
        <p>It seems that one or more steps have failed while registration. Please fix the errors and retry.</p>
        <p>
          If you wish to proceed anyway with creating/updating the CloudFormation stack, resources corresponding to the
          failed steps might not be reflected in the CloudFormation template.
        </p>
      </Message>
    );
  }

  renderOperation(op) {
    const isError = op.failure;
    const isSuccess = op.success;
    const isSkipped = op.skipped;
    const isRunning = op.running;
    const color = isError ? 'red' : isSuccess ? 'green' : isRunning ? 'orange' : isSkipped ? 'orange' : 'grey';
    const message = op.error || op.message;
    const { name } = op;

    return (
      <Segment clearing padded className="mb2" style={{ minHeight: '130px' }} key={op.id}>
        <div className="flex">
          <div className="mr2">
            <Icon color={color} name={isRunning ? 'circle notch' : 'circle'} loading={isRunning} size="large" />
          </div>
          <div className="flex-auto">
            <Header as="h5" className="mb0">
              {name}
            </Header>
            <Progress
              className="mb1 w-100"
              percent={100}
              active={isRunning}
              error={isError}
              success={isSuccess}
              warning={isSkipped}
              color={color}
              size="tiny"
            />
            <div className="fs-9 color-grey">{message}</div>
          </div>
        </div>
      </Segment>
    );
  }

  renderButtons() {
    // Show retry button if allFailed or some failure
    // Show next button if failure or success
    // Show cancel button if allFailed
    const running = this.running;
    const disabled = this.running;
    const success = this.success;
    const failure = this.failure;
    const allFailed = this.allFailed;
    const showNext = !allFailed && (failure || success);
    const showRetry = allFailed || failure;
    const showCancel = showRetry;

    return (
      <div className="mt3">
        {this.failure && this.renderFailedStepsWarning()}
        {showNext && (
          <Button
            floated="right"
            className="ml2"
            primary
            icon="right arrow"
            labelPosition="right"
            content="Next"
            loading={running}
            disabled={disabled}
            onClick={this.handleNext}
          />
        )}

        {showRetry && (
          <Button
            floated="right"
            color="red"
            className="ml2"
            content="Retry"
            loading={running}
            disabled={disabled}
            onClick={this.handleRetry}
          />
        )}

        {showCancel && (
          <Button floated="right" className="ml2" content="Cancel" disabled={disabled} onClick={this.handleCancel} />
        )}
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(SubmitStep, {
  wizard: computed,
  operations: computed,
  running: computed,
  success: computed,
  failure: computed,
  allFailed: computed,
  handleCancel: action,
  handleRetry: action,
  handleNext: action,
});

export default inject()(withRouter(observer(SubmitStep)));
