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
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Header, Icon, Table } from 'semantic-ui-react';

import { swallowError } from '@amzn/base-ui/dist/helpers/utils';
import {
  isStoreReady,
  isStoreLoading,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
  stopHeartbeat,
} from '@amzn/base-ui/dist/models/BaseStore';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import DataSourceStudyRow from './DataSourceStudyRow';

// expected props
// - account (via prop)
// - dataSourceAccountsStore (via injection)
class DataSourceStudiesList extends React.Component {
  componentDidMount() {
    const store = this.getAccountStore();
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getAccountStore();
    stopHeartbeat(store);
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

  render() {
    const store = this.getAccountStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return content;
  }

  renderMain() {
    const account = this.account;
    const accountStore = this.getAccountStore();
    const list = account.studiesList;
    const getStudyStore = study => accountStore.getStudyStore(study.id);

    return (
      <div className="animated fadeIn">
        <Table className="mt0">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell />
              <Table.HeaderCell width={5}>Study Id</Table.HeaderCell>
              <Table.HeaderCell width={7}>Path</Table.HeaderCell>
              <Table.HeaderCell width={2}>Type</Table.HeaderCell>
              <Table.HeaderCell width={1}>Access</Table.HeaderCell>
              <Table.HeaderCell width={1}>Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {_.map(list, item => (
              <DataSourceStudyRow key={item.id} study={item} store={getStudyStore(item)} />
            ))}
          </Table.Body>
        </Table>
      </div>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="book" />
          No registered studies
          <Header.Subheader>To add studies, click Register Studies.</Header.Subheader>
        </Header>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(DataSourceStudiesList, {
  accountsStore: computed,
  account: computed,
});

export default inject('dataSourceAccountsStore')(withRouter(observer(DataSourceStudiesList)));
