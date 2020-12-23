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
import { decorate, computed, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Button, Header, List } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import AccountCfnPanel from '../parts/AccountCfnPanel';

// expected props
// - wizard (via prop)
class CfnStep extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  get wizard() {
    return this.props.wizard;
  }

  get account() {
    return this.wizard.processedAccount;
  }

  handleNext = () => {
    const goto = gotoFn(this);
    this.wizard.reset();

    goto('/data-sources');
  };

  render() {
    const account = this.account;
    return (
      <>
        <Header as="h3" icon textAlign="center" className="mt2" color="grey">
          Register Studies
        </Header>
        <Segment clearing className="p3">
          {this.renderWhatIsNext()}
          <AccountCfnPanel account={account} largeText />
          {this.renderButtons()}
        </Segment>
      </>
    );
  }

  renderWhatIsNext() {
    return (
      <>
        <Header as="h3" className="mb0">
          What to do next?
        </Header>

        <List bulleted size="large">
          <List.Item>
            Review the content of the CloudFormation template to familiarize yourself with the roles and policies that
            will be created in the account.
          </List.Item>
          <List.Item>
            Once provisioned or updated, the stack creates or updates the necessary roles and policies to allow the
            Service Workbench application access to the studies and make them available to the designated researchers.
          </List.Item>
          <List.Item>Follow the steps outlined below</List.Item>
          <List.Item>
            Once you complete the steps below and while the stack is being provisioned or updated, you can click on{' '}
            <b>Done</b>. This will take you to the Data Sources list page where you can test the connection once the
            stack is finished deploying. You will also be able to view this information from within the Data Sources
            list page.
          </List.Item>
        </List>
      </>
    );
  }

  renderButtons() {
    return (
      <div className="mt4">
        <Button floated="right" className="ml2" primary content="Done" onClick={this.handleNext} />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(CfnStep, {
  wizard: computed,
  account: computed,
  handleNext: action,
});

export default inject()(withRouter(observer(CfnStep)));
