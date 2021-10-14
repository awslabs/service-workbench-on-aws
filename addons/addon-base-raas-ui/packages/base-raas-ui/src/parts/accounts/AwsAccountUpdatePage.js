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
import { Container, Icon, Message } from 'semantic-ui-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreReady, isStoreLoading, isStoreError } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import AwsAccountUpdateContent from './AwsAccountUpdateContent';

// expected props
// - accountId (via prop)
// - awsAccountsStore (via injection)
class AwsAccountUpdatePage extends React.Component {
  constructor(props) {
    super(props);
    this.awsAccountUUID = (this.props.match.params || {}).id;
    const awsAccountsStore = this.awsAccountsStore;
    if (!isStoreReady(awsAccountsStore)) {
      swallowError(awsAccountsStore.load());
    }
    const store = this.getAccountStore();
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
  }

  get account() {
    const store = this.awsAccountsStore;
    return store.getAwsAccount(this.awsAccountUUID);
  }

  get awsAccountsStore() {
    return this.props.awsAccountsStore;
  }

  getAccountStore() {
    const accountsStore = this.awsAccountsStore;
    const accountStore = accountsStore.getAwsAccountStore(this.awsAccountUUID);

    return accountStore;
  }

  render() {
    const store = this.getAccountStore();
    let content = null;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = (
        <Container text className="pt4">
          <Message icon>
            <Icon name="circle notched" loading />
            <Message.Content>
              <Message.Header>Loading...</Message.Header>
              Please wait a moment.
            </Message.Content>
          </Message>
        </Container>
      );
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return content;
  }

  renderMain() {
    const account = this.account;

    return (
      <div className="animated fadeIn mb3">
        <AwsAccountUpdateContent account={account} largeText={false} />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AwsAccountUpdatePage, {
  account: computed,
  awsAccountsStore: computed,
  getAccountStore: action,
});

export default inject('awsAccountsStore')(withRouter(observer(AwsAccountUpdatePage)));
