import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { Breadcrumb, Container, Header, Segment } from 'semantic-ui-react';
import { displayError, displaySuccess } from '../../helpers/notification';

import { gotoFn } from '../../helpers/routing';
import { swallowError } from '../../helpers/utils';
import { fromConfiguration } from '../../models/authentication/AuthenticationProviderConfigsStore';
import { isStoreError, isStoreLoading, isStoreReady } from '../../models/BaseStore';
import ConfigurationEditor from '../configuration/ConfigurationEditor';
import ConfigurationReview from '../configuration/ConfigurationReview';
import BasicProgressPlaceholder from '../helpers/BasicProgressPlaceholder';
import ErrorBox from '../helpers/ErrorBox';

// expected props
// - authenticationProviderConfigId (via react router params)
// - authenticationProviderConfigsStore (via injection)
class EditAuthenticationProvider extends Component {
  componentDidMount() {
    const store = this.getStore();
    swallowError(store.load());
  }

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
        <div className="mb4">{content}</div>
      </Container>
    );
  }

  renderMain() {
    const id = this.getAuthenticationProviderConfigId();
    const authenticationProviderConfig = this.getAuthenticationProviderConfig();
    if (!authenticationProviderConfig) return <ErrorBox error={`The Authentication Provider "${id}" does not exist`} />;
    const goto = gotoFn(this);
    return (
      <div>
        <Breadcrumb>
          <Breadcrumb.Section link onClick={() => goto('/authentication-providers')}>
            Authentication Providers
          </Breadcrumb.Section>
          <Breadcrumb.Divider icon="right angle" />
          <Breadcrumb.Section>Authentication Provider</Breadcrumb.Section>
          <Breadcrumb.Divider icon="right angle" />
          <Breadcrumb.Section active>{authenticationProviderConfig.id}</Breadcrumb.Section>
        </Breadcrumb>
        <Segment>
          <div className="ml2">
            {this.renderTitle(authenticationProviderConfig)}
            {this.renderDetails(authenticationProviderConfig.id)}
          </div>
        </Segment>
      </div>
    );
  }

  renderTitle(authenticationProviderConfig) {
    return (
      <Header as="h1" color="grey" className="ml2 mt3">
        {authenticationProviderConfig.config.title}
      </Header>
    );
  }

  renderDetails(authenticationProviderConfigId) {
    const authenticationProviderConfigEditor = this.getStore().getUpdateAuthenticationProviderConfigEditor(
      authenticationProviderConfigId,
    );
    const model = authenticationProviderConfigEditor.configEditor;
    const review = model.review;
    if (review) {
      return <ConfigurationReview model={model} onCancel={this.handleCancel} onSave={this.handleSave} />;
    }
    return <ConfigurationEditor model={model} onCancel={this.handleCancel} />;
  }

  getStore() {
    return this.props.authenticationProviderConfigsStore;
  }

  getAuthenticationProviderConfigId() {
    return decodeURIComponent((this.props.match.params || {}).authenticationProviderConfigId);
  }

  getAuthenticationProviderConfig() {
    const id = this.getAuthenticationProviderConfigId();
    return this.getStore().getAuthenticationProviderConfig(id);
  }

  handleCancel = () => {
    const goto = gotoFn(this);
    goto('/authentication-providers');
  };

  handleSave = async configs => {
    try {
      const authenticationProviderConfigToUpdate = fromConfiguration(configs);
      const original = this.getAuthenticationProviderConfig();

      const typeObj = original.config.type;
      const providerTypeId = typeObj.type;

      await this.getStore().updateAuthenticationProvider({
        providerTypeId,
        providerConfig: authenticationProviderConfigToUpdate,
      });
      const goto = gotoFn(this);
      goto('/authentication-providers');

      displaySuccess(`The authentication provider is updated successfully`);
    } catch (error) {
      displayError(error);
    }
  };
}

export default inject('authenticationProviderConfigsStore')(observer(EditAuthenticationProvider));
