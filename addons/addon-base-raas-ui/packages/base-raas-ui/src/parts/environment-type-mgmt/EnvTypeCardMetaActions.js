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
import React, { Component } from 'react';
import _ from 'lodash';
import { withRouter } from 'react-router-dom';
import { Divider, Popup, Button } from 'semantic-ui-react';
import { observer } from 'mobx-react';

import { gotoFn } from '@aws-ee/base-ui/src/helpers/routing';

/**
 * A plugin component that adds "Test Launch" and "Test launch with data" buttons on the environment type card for
 * non-approved env types to allow admins to test before approving them
 */
// expected props
// - envType
class EnvTypeCardMetaActions extends Component {
  render() {
    const isApproved = _.toLower(this.props.envType.status) === 'approved';
    return (
      !isApproved && (
        <>
          <Divider />
          <Popup
            trigger={
              <Button basic onClick={this.handleTestClick}>
                Test launch
              </Button>
            }
            content="Create a test Workspace"
          />
          <Popup
            trigger={
              <Button basic onClick={this.handleTestWithDataClick}>
                Test launch with data
              </Button>
            }
            content="Create a test Workspace with data"
          />
        </>
      )
    );
  }

  handleTestClick = () => {
    const envType = this.props.envType;
    const goto = gotoFn(this);
    goto(`/workspaces/create/type/${encodeURIComponent(envType.id)}`);
  };

  handleTestWithDataClick = () => {
    const envType = this.props.envType;
    const goto = gotoFn(this);
    goto(`/studies/workspace-type/${encodeURIComponent(envType.id)}`);
  };
}

export default withRouter(observer(EnvTypeCardMetaActions));
