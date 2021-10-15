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
import _ from 'lodash';
import React from 'react';
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Table, Message } from 'semantic-ui-react';

import { isStoreLoading, isStoreError, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import { swallowError, nicePrice } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

// expected props
// - envId (via prop)
// - scEnvironmentCostsStore  (via injection)
class ScEnvironmentCostTable extends React.Component {
  componentDidMount() {
    const costStore = this.getEnvCostStore();
    if (!isStoreReady(costStore) && !isStoreError(costStore)) {
      swallowError(costStore.load());
    }

    costStore.startHeartbeat();
  }

  componentWillUnmount() {
    const costStore = this.getEnvCostStore();
    costStore.stopHeartbeat();
  }

  get costsStore() {
    return this.props.scEnvironmentCostsStore;
  }

  get envId() {
    return this.props.envId;
  }

  getEnvCostStore() {
    const costsStore = this.costsStore;
    const envId = this.envId;
    return costsStore.getScEnvironmentCostStore(envId);
  }

  render() {
    const store = this.getEnvCostStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return <>{content}</>;
  }

  renderMain() {
    const costStore = this.getEnvCostStore();
    const cost = costStore.scEnvironmentCost;
    const list = cost.list;
    const isEmpty = _.isEmpty(list);
    const renderRow = (index, key, value) => (
      <Table.Row key={index}>
        <Table.Cell width={5}>{key}</Table.Cell>
        <Table.Cell width={11} className="breakout">
          ${nicePrice(value)}
        </Table.Cell>
      </Table.Row>
    );

    return (
      <>
        {!isEmpty && (
          <Table definition className="mt3">
            <Table.Body>{_.map(list, (item, index) => renderRow(index, item.date, item.amount))}</Table.Body>
          </Table>
        )}
        {isEmpty && <Message className="mt3" content="None is available" />}
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentCostTable, {
  costsStore: computed,
  envId: computed,
});

export default inject('scEnvironmentCostsStore')(withRouter(observer(ScEnvironmentCostTable)));
