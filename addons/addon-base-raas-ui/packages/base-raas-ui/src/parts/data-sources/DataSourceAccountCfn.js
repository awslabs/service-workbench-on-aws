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
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreReady, isStoreLoading, isStoreError, stopHeartbeat } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import AccountCfnPanel from './parts/AccountCfnPanel';

// expected props
// - account (via prop)
// - dataSourceAccountsStore (via injection)
class DataSourceAccountCfn extends React.Component {
  componentDidMount() {
    const store = this.getStackInfoStore();
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getStackInfoStore();
    stopHeartbeat(store);
  }

  get account() {
    return this.props.account;
  }

  get accountsStore() {
    return this.props.dataSourceAccountsStore;
  }

  getStackInfoStore() {
    const accountsStore = this.accountsStore;
    const account = this.account || {};
    const accountStore = accountsStore.getAccountStore(account.id);

    return accountStore.getStackInfoStore();
  }

  render() {
    const store = this.getStackInfoStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} />;
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
        <AccountCfnPanel account={account} />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(DataSourceAccountCfn, {
  accountsStore: computed,
  account: computed,
});

export default inject('dataSourceAccountsStore')(withRouter(observer(DataSourceAccountCfn)));
