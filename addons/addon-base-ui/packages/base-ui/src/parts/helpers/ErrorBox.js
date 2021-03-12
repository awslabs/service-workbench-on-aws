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
import { observer } from 'mobx-react';
import { Message, Button } from 'semantic-ui-react';

// expected props
// - error (an object with a "message" property  or a string)
// - onRetry (via prop) a call back function
// - onCancel (via prop) a call back function
// - className
class ErrorBox extends React.Component {
  handleRetry = () => {
    Promise.resolve()
      .then(() => this.props.onRetry())
      .catch(_err => {
        /* ignore */
      });
  };

  render() {
    const defaultMessage = 'Hmm... something went wrong';
    const rawMessage = this.props.error || defaultMessage;
    const message = _.isString(rawMessage) ? rawMessage : _.get(rawMessage, 'message', defaultMessage);
    const shouldRetry = _.isFunction(this.props.onRetry);
    const className = this.props.className ? this.props.className : 'p3';

    return (
      <div className={`${className}`}>
        <Message negative className="clearfix" onDismiss={this.props.onCancel}>
          <Message.Header>A problem was encountered</Message.Header>
          <p>{message}</p>
          {shouldRetry && (
            <Button floated="right" basic color="red" onClick={this.handleRetry}>
              Retry
            </Button>
          )}
        </Message>
      </div>
    );
  }
}

export default observer(ErrorBox);
