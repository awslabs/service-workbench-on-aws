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
import { decorate, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Icon, Header, Segment } from 'semantic-ui-react';
import { gotoFn } from '@amzn/base-ui/dist/helpers/routing';
import { swallowError } from '@amzn/base-ui/dist/helpers/utils';
import { isStoreLoading, isStoreError, isStoreEmpty, isStoreReady } from '@amzn/base-ui/dist/models/BaseStore';
import BasicProgressPlaceholder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';

// expected props
// - helloStore (via injection)
class HelloPage extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
    const store = this.helloStore;
    if (!isStoreReady(store)) swallowError(store.load());
  }

  goto(pathname) {
    const goto = gotoFn(this);
    goto(pathname);
  }

  get helloStore() {
    return this.props.helloStore;
  }

  render() {
    const store = this.helloStore;
    if (!store) return null;

    // Render loading, error, or tab content
    let content;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="mt3 mr0 ml0" />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder segmentCount={1} className="mt3 mr0 ml0" />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else {
      content = this.renderContent();
    }

    return (
      <Container className="mt3">
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderContent() {
    const list = this.helloStore.list;
    return (
      <Segment.Group className="mt3">
        {_.map(list, (item, index) => (
          <Segment key={index}>{item.message}</Segment>
        ))}
      </Segment.Group>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder className="mt3">
        <Header icon className="color-grey">
          <Icon name="coffee" />
          Hello
          <Header.Subheader>Sorry, no hello messages to display</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    return (
      <div className="flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="hand spock" className="align-top" />
          <Header.Content className="left-align">Hello</Header.Content>
        </Header>
      </div>
    );
  }
}

decorate(HelloPage, {
  helloStore: computed,
});

export default inject('helloStore')(withRouter(observer(HelloPage)));
