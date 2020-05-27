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
