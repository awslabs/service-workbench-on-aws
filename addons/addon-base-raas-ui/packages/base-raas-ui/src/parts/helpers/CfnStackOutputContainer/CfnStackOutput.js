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

import React, { PureComponent } from 'react';
import { Message, Icon, List } from 'semantic-ui-react';
import PropTypes from 'prop-types';

const LOADING_ICON = 'circle notched';
const MESSAGE_POS = 'positive';
const MESSAGE_NEG = 'negative';
const MESSAGE_INFO = 'info';

export default class CfnStackOutput extends PureComponent {
  render() {
    let messageType = MESSAGE_POS;
    let iconType = 'check';
    if (this.props.isStackExecuting) {
      messageType = MESSAGE_INFO;
      iconType = LOADING_ICON;
    } else if (this.props.errorMessage) {
      messageType = MESSAGE_NEG;
      iconType = 'dont';
    }

    return (
      <Message
        icon
        positive={messageType === MESSAGE_POS}
        negative={messageType === MESSAGE_NEG}
        info={messageType === MESSAGE_INFO}
      >
        <Icon name={iconType} loading={iconType === LOADING_ICON} />
        <Message.Content>
          <Message.Header>Results from the creating the stack</Message.Header>
          <List>
            {this.props.outputs.map((item, index) => {
              // eslint-disable-next-line react/no-array-index-key
              return <List.Item key={index}>{item}</List.Item>;
            })}
          </List>
          {this.props.errorMessage}
        </Message.Content>
      </Message>
    );
  }
}
CfnStackOutput.propTypes = {
  isStackExecuting: PropTypes.bool.isRequired,
  outputs: PropTypes.arrayOf(PropTypes.string).isRequired,
  errorMessage: PropTypes.string,
};
CfnStackOutput.defaultProps = {
  errorMessage: '',
};
