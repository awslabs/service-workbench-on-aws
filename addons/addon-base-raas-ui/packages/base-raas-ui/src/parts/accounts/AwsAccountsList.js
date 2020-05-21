import React from 'react';
import { Button, Container, Header, Icon, Label, Message } from 'semantic-ui-react';
import { withRouter } from 'react-router-dom';
import { decorate, observable, runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import ReactTable from 'react-table';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

class AwsAccountsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    runInAction(() => {
      // An object that keeps track of which user is being edited
      // Each key in the object below has key as user's unique id (<ns>/<username>)
      // and value as flag indicating whether to show the editor for the user
      this.mapOfUsersBeingEdited = {};
      this.formProcessing = false;
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
    const awsAccountsData = this.getAwsAccounts();
    const pageSize = 5;
    const showPagination = awsAccountsData.length > pageSize;
    return (
      <div>
        <ReactTable
          data={awsAccountsData}
          showPagination={showPagination}
          defaultPageSize={pageSize}
          className="-striped -highlight"
          filterable
          defaultFilterMethod={(filter, row) => {
            const columnValue = String(row[filter.id]).toLowerCase();
            const filterValue = filter.value.toLowerCase();
            return columnValue.indexOf(filterValue) >= 0;
          }}
          columns={[
            {
              Header: 'Account Name',
              accessor: 'name',
            },
            {
              Header: 'AWS Account ID',
              accessor: 'accountId',
            },
            {
              Header: 'Description',
              accessor: 'description',
            },
            {
              Header: 'Role ARN',
              accessor: 'roleArn',
            },
            {
              Header: 'External ID',
              accessor: 'externalId',
            },
            {
              Header: 'VPC ID',
              accessor: 'vpcId',
            },
            {
              Header: 'Subnet ID',
              accessor: 'subnetId',
            },
            {
              Header: 'Encryption Key Arn',
              accessor: 'encryptionKeyArn',
            },
          ]}
        />
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
  formProcessing: observable,
});

export default inject('awsAccountsStore', 'accountsStore')(withRouter(observer(AwsAccountsList)));
