import _ from 'lodash';
import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Header, Icon, Label, Segment } from 'semantic-ui-react';
import { gotoFn } from '../../helpers/routing';

import { swallowError } from '../../helpers/utils';
import { isStoreError, isStoreLoading, isStoreNotEmpty, isStoreReady } from '../../models/BaseStore';
import BasicProgressPlaceholder from '../helpers/BasicProgressPlaceholder';
import ErrorBox from '../helpers/ErrorBox';
import AuthenticationProviderCard from './AuthenticationProviderCard';

// expected props
// -  authenticationProviderConfigsStore (via injection)
class AuthenticationProvidersList extends Component {
  componentDidMount() {
    const store = this.getStore();
    swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getStore();
    store.stopHeartbeat();
  }

  getStore() {
    return this.props.authenticationProviderConfigsStore;
  }

  handleAddAuthenticationProviderClick = _event => {
    const goto = gotoFn(this);
    goto('/authentication-providers/add');
  };

  render() {
    const store = this.getStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder segmentCount={3} />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3">
        <div className="mb4">
          {this.renderTitle()}
          {content}
        </div>
      </Container>
    );
  }

  renderTitle() {
    const renderCount = () => {
      const store = this.getStore();
      const showCount = isStoreReady(store) && isStoreNotEmpty(store);
      const list = store.list;
      return (
        showCount && (
          <Label circular size="medium">
            {list.length}
          </Label>
        )
      );
    };

    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="user secret" className="align-top" />
          <Header.Content className="left-align">
            Authentication Providers
            {renderCount()}
          </Header.Content>
        </Header>
        {/* <Button color="blue" size="medium" basic onClick={this.handleAddAuthenticationProviderClick}>Add Authentication Provider</Button> */}
      </div>
    );
  }

  renderMain() {
    const store = this.getStore();
    const list = store.list;

    return (
      <div>
        {_.map(list, (authNProviderConfig, idx) => (
          <Segment clearing key={authNProviderConfig.id} className="mb2">
            <AuthenticationProviderCard authenticationProviderConfig={authNProviderConfig} pos={idx + 1} />
          </Segment>
        ))}
      </div>
    );
  }
}

export default inject('authenticationProviderConfigsStore')(withRouter(observer(AuthenticationProvidersList)));
