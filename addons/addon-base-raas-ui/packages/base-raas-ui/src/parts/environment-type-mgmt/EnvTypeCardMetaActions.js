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
