import React from 'react';
import { Icon, Label } from 'semantic-ui-react';
import { observer } from 'mobx-react';

class EnvironmentStatusIcon extends React.Component {
  getEnvironment() {
    return this.props.environment;
  }

  render() {
    const status = this.getEnvironment().status;
    if (status === 'COMPLETED') {
      return (
        <Label basic size="mini" color="green">
          Ready
        </Label>
      );
    }
    if (status === 'TERMINATED') {
      return (
        <Label basic size="mini" color="red">
          Terminated
        </Label>
      );
    }
    if (status === 'FAILED') {
      return (
        <Label basic size="mini" color="red">
          Error
        </Label>
      );
    }
    if (status === 'TERMINATING_FAILED') {
      return (
        <Label basic size="mini" color="red">
          Failed to terminate
        </Label>
      );
    }
    if (status === 'TERMINATING') {
      return (
        <div>
          <Label basic size="mini">
            Terminating
            <Icon loading name="spinner" size="large" color="red" className="ml1 mr1" />
          </Label>
        </div>
      );
    }
    return (
      <Label basic size="mini">
        Starting
        <Icon loading name="spinner" size="large" color="yellow" className="ml1 mr1" />
      </Label>
    );
  }
}

export default observer(EnvironmentStatusIcon);
