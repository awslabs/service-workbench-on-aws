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
