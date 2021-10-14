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
import { Label, Popup, Statistic, Placeholder } from 'semantic-ui-react';

import { isStoreError, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import { swallowError, nicePrice } from '@aws-ee/base-ui/dist/helpers/utils';

// expected props
// - envId (via prop)
// - scEnvironmentCostsStore  (via injection)
class ScEnvironmentCost extends React.Component {
  componentDidMount() {
    const costStore = this.getEnvCostStore();
    if (!isStoreReady(costStore) && !isStoreError(costStore)) {
      swallowError(costStore.load());
    }
  }

  get costsStore() {
    return this.props.scEnvironmentCostsStore;
  }

  get envId() {
    return this.props.envId;
  }

  get envCost() {
    const envId = this.envId;
    return this.costsStore.getScEnvironmentCost(envId);
  }

  getEnvCostStore() {
    const costsStore = this.costsStore;
    const envId = this.envId;
    return costsStore.getScEnvironmentCostStore(envId);
  }

  render() {
    const envCost = this.envCost;
    const isLoading = _.isUndefined(envCost);
    const isError = !isLoading && !_.isEmpty(envCost.error);
    const previousCost = !isLoading && !isError ? envCost.previousDayCost : 0;

    if (isLoading) {
      return (
        <Placeholder>
          <Placeholder.Line length="full" />
          <Placeholder.Line length="full" />
        </Placeholder>
      );
    }

    return (
      <>
        <div className="center breakout">
          <Statistic color={isError ? 'red' : 'black'} size="mini">
            <Statistic.Value>{isError ? 'N/A' : `$${nicePrice(previousCost)}`}</Statistic.Value>
            <Statistic.Label>Yesterday&apos;s Cost</Statistic.Label>
          </Statistic>
        </div>
        {isError && this.renderErrorPopup(envCost.error)}
      </>
    );
  }

  renderErrorPopup(error) {
    return (
      <div className="mt2 center">
        <Popup
          trigger={
            <Label size="mini" basic color="red">
              Show Error
            </Label>
          }
          basic
        >
          <div className="color-red">
            <p>An error occurred while retrieving the cost information.</p>
            <p>
              If this workspace is provisioned in a new account, verify with your administer that the cost explorer
              feature is enabled for the account.
            </p>
            <p>The system returned this error message:</p>
            <p>{error}</p>
          </div>
        </Popup>
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentCost, {
  costsStore: computed,
  envId: computed,
});

export default inject('scEnvironmentCostsStore')(withRouter(observer(ScEnvironmentCost)));
