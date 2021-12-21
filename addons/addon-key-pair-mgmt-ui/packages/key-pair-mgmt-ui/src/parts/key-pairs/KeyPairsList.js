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
import { decorate, computed, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Segment, Header, Icon, Button, Label } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreLoading, isStoreEmpty, isStoreNotEmpty, isStoreError } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import KeyPairCard from './KeyPairCard';

// expected props
// keyPairsStore (via injection)
class KeyPairsList extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
    const store = this.keyPairsStore;
    swallowError(store.load());
  }

  get keyPairsStore() {
    return this.props.keyPairsStore;
  }

  handleCreateKeyPair = event => {
    event.preventDefault();
    event.stopPropagation();

    const goto = gotoFn(this);
    goto(`/key-pair-management/create`);
  };

  render() {
    const store = this.keyPairsStore;
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

    return (
      <Container className="mt3 animated fadeIn">
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderMain() {
    const store = this.keyPairsStore;
    const list = store.list;

    return (
      <div>
        {_.map(list, item => (
          <Segment className="p3 mb4" clearing key={item.id}>
            <KeyPairCard keyPair={item} />
          </Segment>
        ))}
      </div>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="terminal" />
          No SSH Keys
          <Header.Subheader>To create an SSH key, click Create Key.</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="key" className="align-top" />
          <Header.Content className="left-align">SSH Keys {this.renderTotal()}</Header.Content>
        </Header>
        <div>
          <Button color="blue" size="medium" basic onClick={this.handleCreateKeyPair}>
            Create Key
          </Button>
        </div>
      </div>
    );
  }

  renderTotal() {
    const store = this.keyPairsStore;
    if (isStoreError(store) || isStoreLoading(store)) return null;

    return <Label circular>{store.total}</Label>;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(KeyPairsList, {
  keyPairsStore: computed,
  handleCreateKeyPair: action,
});

export default inject('keyPairsStore')(withRouter(observer(KeyPairsList)));
