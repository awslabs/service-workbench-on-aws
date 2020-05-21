import _ from 'lodash';
import React from 'react';
import { observer } from 'mobx-react';
import { Message, Button } from 'semantic-ui-react';

// expected props
// - error (an object with a "message" property  or a string)
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
        <Message negative className="clearfix">
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
