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
