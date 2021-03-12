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

/* eslint-disable max-classes-per-file */
import _ from 'lodash';
import React from 'react';
import { decorate, computed, observable, action, runInAction } from 'mobx';
import { observer, inject, Observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Tab, Label, Menu, Button, Message } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';

import { niceNumber, swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreNew, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';

import By from '../helpers/By';
import DataSourceStudiesList from './DataSourceStudiesList';
import DataSourceAccountCfn from './DataSourceAccountCfn';
import DataSourceAccountInfo from './DataSourceAccountInfo';
import { Operation } from '../../models/helpers/Operation';
import AccountConnectionPanel from './parts/AccountConnectionPanel';
import AccountStatusMessage from './parts/AccountStatusMessage';

// This component is used with the TabPane to replace the default Segment wrapper since
// we don't want to display the border.
// eslint-disable-next-line react/prefer-stateless-function
class TabPaneWrapper extends React.Component {
  render() {
    return <>{this.props.children}</>;
  }
}

// expected props
// - account (via prop)
// - dataSourceAccountsStore (via injection)
class DataSourceAccountCard extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.expanded = false;
      this.connectionPanel = {
        show: false,
        operation: Operation.create({}),
      };
    });
  }

  get account() {
    return this.props.account;
  }

  get accountsStore() {
    return this.props.dataSourceAccountsStore;
  }

  getAccountStore() {
    const accountsStore = this.accountsStore;
    const account = this.account || {};
    return accountsStore.getAccountStore(account.id);
  }

  handleCheckConnection = () => {
    this.connectionPanel.show = true;

    const account = this.account;
    const accountsStore = this.accountsStore;
    const operation = this.connectionPanel.operation;
    const doWork = async () => {
      await accountsStore.checkAccountReachability(account.id);
    };

    swallowError(operation.run(doWork));
  };

  handleDismissPanel = () => {
    this.connectionPanel.show = false;
  };

  render() {
    const account = this.account;
    const operation = this.connectionPanel.operation;
    const showPanel = this.connectionPanel.show;
    const reachable = account.reachableState;
    const hasMsg = !_.isEmpty(account.statusMessageInfo.message);
    const showMsg = !showPanel && (!reachable || (reachable && hasMsg));

    return (
      <div className="animated fadeIn">
        <Button size="mini" floated="right" color="brown" basic onClick={this.handleCheckConnection}>
          Test Connection
        </Button>
        {this.renderTitle(account)}
        {this.renderStatus(account)}
        {showMsg && <AccountStatusMessage account={account} />}
        {showPanel && (
          <AccountConnectionPanel account={account} operation={operation} onCancel={this.handleDismissPanel} />
        )}
        {this.renderStackMismatch(account)}
        {this.renderTabs()}
      </div>
    );
  }

  renderTabs() {
    const getMenuItemLabel = () => {
      const store = this.getAccountStore();
      const emptySpan = null;
      if (!store) return emptySpan;
      if (isStoreError(store)) return emptySpan;
      if (isStoreNew(store)) return emptySpan;
      if (isStoreLoading(store)) return emptySpan;
      return <Label>{niceNumber(store.studiesTotal)}</Label>;
    };

    const account = this.account;
    const panes = [
      {
        menuItem: <Menu.Item key="studies">Studies {getMenuItemLabel()}</Menu.Item>,
        render: () => (
          <Tab.Pane attached={false} key="studies" as={TabPaneWrapper}>
            <Observer>{() => <DataSourceStudiesList account={account} />}</Observer>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'CloudFormation',
        render: () => (
          <Tab.Pane attached={false} key="cloudformation" as={TabPaneWrapper}>
            <Observer>{() => <DataSourceAccountCfn account={account} />}</Observer>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Account Information',
        render: () => (
          <Tab.Pane attached={false} key="accountInfo" as={TabPaneWrapper}>
            <Observer>{() => <DataSourceAccountInfo account={account} />}</Observer>
          </Tab.Pane>
        ),
      },
    ];

    return <Tab className="mt2" menu={{ secondary: true, pointing: true }} renderActiveOnly panes={panes} />;
  }

  renderTitle(account) {
    return (
      <Header as="h3" className="mt3 breakout">
        {account.name}
        <Header.Subheader>
          <span className="fs-8 color-grey mr1">
            Registered <TimeAgo date={account.createdAt} /> <By uid={account.createdBy} className="mr1" />
            &mdash;
          </span>
          <span className="fs-8 color-grey mr1">
            Status checked <TimeAgo date={account.statusAt} className="mr1" />
            &mdash;
          </span>
          <span className="fs-8 color-grey">AWS Account # {account.id}</span>
        </Header.Subheader>
      </Header>
    );
  }

  renderStatus(account) {
    const { state } = account;
    return (
      <Label attached="top left" size="mini" color={state.color}>
        {state.display}
      </Label>
    );
  }

  renderStackMismatch(account) {
    const stackOutDated = account.stackOutDated;
    const incorrectStackNameProvisioned = account.incorrectStackNameProvisioned;

    if (!stackOutDated && !incorrectStackNameProvisioned) return null;

    if (incorrectStackNameProvisioned) {
      return (
        <Message warning>
          <Message.Header>Incorrect stack name</Message.Header>
          <p>
            It seems that the correct CloudFormation stack was deployed to AWS account <b>{account.id}</b> but with an
            incorrect stack name. Please ensure that you have the latest CloudFormation template deployed with the stack
            name {account.stack} in the account. If you just updated the stack you can run the connection test again.
          </p>
        </Message>
      );
    }

    return (
      <Message warning>
        <Message.Header>Stack is outdated</Message.Header>
        <p>
          It seems that the CloudFormation stack {account.stack} deployed to AWS account <b>{account.id}</b> is outdated
          and does not contain the latest changes made. Please use the latest CloudFormation template to update the
          stack. If you just updated the stack you can run the connection test again.
        </p>
      </Message>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(DataSourceAccountCard, {
  accountsStore: computed,
  account: computed,
  handleCheckConnection: action,
  handleDismissPanel: action,
  connectionPanel: observable,
});

export default inject('dataSourceAccountsStore')(withRouter(observer(DataSourceAccountCard)));
