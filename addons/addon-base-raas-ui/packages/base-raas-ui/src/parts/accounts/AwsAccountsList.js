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
import _ from 'lodash';
import { Button, Container, Header, Icon, Label, Message, Segment } from 'semantic-ui-react';
import { withRouter } from 'react-router-dom';
import { decorate, observable, runInAction, action } from 'mobx';
import { inject, observer } from 'mobx-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import AccountCard from './AccountCard';
import AccountsFilterButtons from './AccountsFilterButtons';

class AwsAccountsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    runInAction(() => {
      // An object that keeps track of which user is being edited
      // Each key in the object below has key as user's unique id (i.e., uid)
      // and value as flag indicating whether to show the editor for the user
      this.mapOfUsersBeingEdited = {};
      this.selectedFilter = 'All'; // case-sensitive, see AwsAccountsStore.js for options
    });
  }

  componentDidMount() {
    const accountsStore = this.props.accountsStore;
    const awsAccountsStore = this.props.awsAccountsStore;
    swallowError(accountsStore.load());
    swallowError(awsAccountsStore.load());
    accountsStore.startHeartbeat();
    awsAccountsStore.startHeartbeat();
  }

  componentWillUnmount() {
    const accountsStore = this.props.accountsStore;
    const awsAccountsStore = this.props.awsAccountsStore;
    accountsStore.stopHeartbeat();
    awsAccountsStore.stopHeartbeat();
  }

  getAwsAccountsStore() {
    const store = this.props.awsAccountsStore;
    return store;
  }

  getAwsAccounts() {
    const store = this.getAwsAccountsStore();
    return store.list;
  }

  renderMain() {
    const awsAccountsStore = this.getAwsAccountsStore();
    const selectedFilter = this.selectedFilter;
    const awsAccountsData = awsAccountsStore.filtered(selectedFilter);
    const isEmpty = _.isEmpty(awsAccountsData);
    return (
      <div data-testid="awsaccounts">
        <AccountsFilterButtons
          selectedFilter={selectedFilter}
          onSelectedFilter={this.handleSelectedFilter}
          className="mb3"
        />
        {!isEmpty && (
          <div className="mt3 mr0 ml0">
            {awsAccountsData.map(account => (
              <AccountCard
                key={account.accountId}
                account={account}
                permissionStatus={account.permissionStatus}
                isSelectable
              />
            ))}
          </div>
        )}
        {isEmpty && (
          <Segment placeholder>
            <Header icon className="color-grey">
              <Icon name="user x" />
              No accounts matching the selected filter.
              <Header.Subheader>Select &apos;All&apos; to view all accounts</Header.Subheader>
            </Header>
          </Segment>
        )}
      </div>
    );
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  handleAddAwsAccount = () => {
    this.goto('/aws-accounts/add');
  };

  handleCreateAwsAccount = () => {
    this.goto('/aws-accounts/create');
  };

  handleSelectedFilter = name => {
    this.selectedFilter = name;
  };

  handleCheckAccountStatus = () => {
    const awsAccountsStore = this.getAwsAccountsStore();
    awsAccountsStore.forceCheckAccountPermissions();
  };

  renderHeader() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="amazon" className="align-top" />
          <Header.Content className="left-align">
            AWS Accounts
            {this.renderTotal()}
          </Header.Content>
        </Header>
        <Button color="blue" size="medium" basic onClick={this.handleCreateAwsAccount}>
          Create AWS Account
        </Button>
        <Button className="ml2" color="blue" size="medium" basic onClick={this.handleAddAwsAccount}>
          Add AWS Account
        </Button>
        <Button className="ml2" color="blue" size="medium" basic onClick={this.handleCheckAccountStatus}>
          Refresh Account Status
        </Button>
      </div>
    );
  }

  renderTotal() {
    return <Label circular>{this.getAwsAccounts().length}</Label>;
  }

  handleDismiss(id) {
    const accountsStore = this.props.accountsStore;
    accountsStore.removeItem(id);
    this.componentDidMount();
  }

  renderCreatingAccountNotification() {
    const accountsStore = this.props.accountsStore;
    const pendingAccount = accountsStore.listCreatingAccount;
    const errorAccounts = accountsStore.listErrorAccount;
    return (
      <div className="mt3 mb3 animated fadeIn">
        {pendingAccount.map(account => (
          <Message>
            <Icon name="circle notched" loading />
            Trying to create accountID: {account.id}
          </Message>
        ))}
        {errorAccounts.map(account => (
          <Message onDismiss={() => this.handleDismiss(account.id)}>
            <Icon name="times" color="red" />
            Error happended in creating accountID: {account.id}. If the account is created, please contact follow{' '}
            <a
              href="https://aws.amazon.com/blogs/security/aws-organizations-now-supports-self-service-removal-of-accounts-from-an-organization/"
              target="_blank"
              rel="noopener noreferrer"
            >
              instruction
            </a>{' '}
            to remove it. You may close this message after you make sure the account is removed.
          </Message>
        ))}
      </div>
    );
  }

  render() {
    const store = this.getAwsAccountsStore();
    let content;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder segmentCount={3} />;
    } else {
      content = this.renderMain();
    }
    return (
      <Container className="mt3 animated fadeIn">
        {this.renderHeader()}
        {this.renderCreatingAccountNotification()}
        {content}
      </Container>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AwsAccountsList, {
  mapOfUsersBeingEdited: observable,
  selectedFilter: observable,
  handleSelectedFilter: action,
});

export default inject('awsAccountsStore', 'accountsStore')(withRouter(observer(AwsAccountsList)));
