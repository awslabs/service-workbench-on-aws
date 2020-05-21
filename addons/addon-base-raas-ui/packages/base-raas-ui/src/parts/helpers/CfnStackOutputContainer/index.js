import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import CfnStackOutput from './CfnStackOutput';

export default class CfnStackOutputContainer extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isStackExecuting: true,
      errorMessage: '',
      outputs: [],
    };
  }

  componentDidMount() {
    this.timer = setInterval(this.describeCfnStack, 15000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  describeCfnStack = async () => {
    if (this.state.isStackExecuting === false) {
      clearInterval(this.timer);
      return;
    }
    this.setState({
      isStackExecuting: true,
    });
    const results = await this.props.cfn.describeStack(this.props.stackName);

    this.setState({
      // eslint-disable-next-line react/no-access-state-in-setstate
      outputs: [...this.state.outputs, JSON.stringify(results)],
      isStackExecuting: !results.isDone,
    });
  };

  render() {
    return <CfnStackOutput {...this.state} />;
  }
}
CfnStackOutputContainer.propTypes = {
  stackName: PropTypes.string.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  cfn: PropTypes.object.isRequired,
};
