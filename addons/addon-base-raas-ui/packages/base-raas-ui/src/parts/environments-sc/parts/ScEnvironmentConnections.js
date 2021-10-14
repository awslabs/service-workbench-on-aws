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
import { Segment, Icon, Header } from 'semantic-ui-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import {
  isStoreLoading,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
  isStoreReady,
} from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import ScEnvironmentHttpConnections from './ScEnvironmentHttpConnections';
import ScEnvironmentSshConnections from './ScEnvironmentSshConnections';
import ScEnvironmentRdpConnections from './ScEnvironmentRdpConnections';

// expected props
// - scEnvironment (via prop)
// - scEnvironmentsStore (via injection)
class ScEnvironmentConnections extends React.Component {
  componentDidMount() {
    const store = this.getConnectionStore();
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  getConnectionStore() {
    return this.envsStore.getScEnvConnectionStore(this.environment.id);
  }

  render() {
    const store = this.getConnectionStore();
    const env = this.environment;
    const state = env.state;
    const canConnect = state.canConnect;

    if (!canConnect) return null;
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="pt2 mb2" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} className="mt2 mb2" />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreNotEmpty(store)) {
      content = this.renderConnections();
    } else {
      content = null;
    }
    return <div className="fadeIn animated">{content}</div>;
  }

  renderConnections() {
    const env = this.environment;
    const isHttp = scheme => scheme === 'http' || scheme === 'https' || _.isEmpty(scheme);
    const isSsh = scheme => scheme === 'ssh';
    const isRdp = scheme => scheme === 'rdp';
    const hasHttp = !_.isEmpty(env.getConnections(item => isHttp(item.scheme)));
    const hasSsh = !_.isEmpty(env.getConnections(item => isSsh(item.scheme)));
    const hasRdp = !_.isEmpty(env.getConnections(item => isRdp(item.scheme)));

    return (
      // Keep the order the way it is, otherwise the drop down menus in the ssh connections
      // will be cropped due to the 'fadeIn animated' changing the z index
      <>
        {hasHttp && <ScEnvironmentHttpConnections scEnvironment={env} />}
        {hasRdp && <ScEnvironmentRdpConnections scEnvironment={env} />}
        {hasSsh && <ScEnvironmentSshConnections scEnvironment={env} />}
      </>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder className="mt2 mb2">
        <Header icon className="color-grey">
          <Icon name="linkify" />
          No Connections
          <Header.Subheader>This workspace does not have any defined connections.</Header.Subheader>
        </Header>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentConnections, {
  envsStore: computed,
  environment: computed,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentConnections)));
