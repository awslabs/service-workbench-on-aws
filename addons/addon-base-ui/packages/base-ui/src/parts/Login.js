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
import { withRouter } from 'react-router-dom';
import { observable, action, decorate, runInAction, computed } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Button, Form, Grid, Header, Segment, Label, Input, Select, Image } from 'semantic-ui-react';

import { displayError } from '../helpers/notification';
import { branding } from '../helpers/settings';

// From https://github.com/Semantic-Org/Semantic-UI-React/blob/master/docs/app/Layouts/LoginLayout.js
// expected props
// - authentication (via injection)
// - authenticationProviderPublicConfigsStore (via injection)
// - assets (via injection)
class Login extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.username = '';
      this.password = '';
      this.loading = false;

      this.authenticationProviderError = '';
      this.usernameError = '';
      this.passwordError = '';

      // When the login page is shown, we default to the auth provider id of the first provider
      // in the this.authProviderOptions list
      const authentication = this.props.authentication;
      authentication.setSelectedAuthenticationProviderId(_.get(this.authProviderOptions, '[0].key', ''));
    });
  }

  getStore() {
    return this.props.authenticationProviderPublicConfigsStore;
  }

  get authProviderOptions() {
    const params = new URL(document.location).searchParams;
    const showInternal = _.isString(params.get('internal'));
    const store = this.getStore();
    const options = store.authenticationProviderOptions;
    const size = _.size(options);

    // If we have one or zero options, we don't want to filter them, otherwise
    // we might be filtering the only option available.
    if (size <= 1) return options;

    return _.filter(store.authenticationProviderOptions, config => {
      if (config.key === 'internal' && showInternal) return true;
      return config.key !== 'internal';
    });
  }

  handleChange = name =>
    action(event => {
      this[name] = event.target.value;
      if (name === 'username') this.usernameError = '';
      if (name === 'password') this.passwordError = '';
    });

  handleAuthenticationProviderChange = action((_event, { value }) => {
    this.props.authentication.setSelectedAuthenticationProviderId(value);
  });

  handleLogin = action(event => {
    event.preventDefault();
    event.stopPropagation();

    this.authenticationProviderError = '';
    this.usernameError = '';
    this.passwordError = '';
    const username = _.trim(this.username) || '';
    const password = this.password || '';
    const selectedAuthenticationProviderId = this.props.authentication.selectedAuthenticationProviderId || '';
    let error = false;

    if (_.isEmpty(selectedAuthenticationProviderId)) {
      this.authenticationProviderError = 'please select authentication provider';
      error = true;
    }

    const collectUserNamePassword = this.props.authentication.shouldCollectUserNamePassword;
    // Validate username and password fields only if the selected authentication provider requires
    // username and password to be submitted.
    // For example, in case of SAML we do not collect username/password and in that case,
    // we won't validate username/password. It will be the responsibility of the Identity Provider
    // Do we need to collect username/password or not is specified by the authentication provider configuration
    // via "credentialHandlingType" field.
    if (collectUserNamePassword) {
      if (_.isEmpty(username)) {
        this.usernameError = 'username is required';
        error = true;
      }

      if (!_.isEmpty(username) && username.length < 3) {
        this.usernameError = 'username must be at least 3 characters long';
        error = true;
      }

      if (_.isEmpty(password)) {
        this.passwordError = 'password is required';
        error = true;
      }
      if (!_.isEmpty(password) && password.length < 4) {
        this.passwordError = 'password must be at least 4 characters long';
        error = true;
      }
    }

    if (error) return;

    const authentication = this.props.authentication;
    this.loading = true;

    Promise.resolve()
      .then(() =>
        authentication.login({
          username,
          password,
        }),
      )
      .catch(err => displayError(err))
      .finally(
        action(() => {
          this.loading = false;
        }),
      );
  });

  render() {
    const error = !!(this.usernameError || this.passwordError || this.authenticationProviderError);

    const authenticationProviderOptions = this.authProviderOptions;
    const selectedAuthenticationProviderId = this.props.authentication.selectedAuthenticationProviderId;

    const renderAuthenticationProviders = () => {
      // Display authenticationProviderOptions only if there are more than one to choose from
      // if there is only one authentication provider available then use that
      if (authenticationProviderOptions && authenticationProviderOptions.length > 1) {
        return (
          <Form.Field error={!!this.usernameError} required>
            <Select
              placeholder="Select Authentication Provider"
              options={authenticationProviderOptions}
              defaultValue={selectedAuthenticationProviderId}
              onChange={this.handleAuthenticationProviderChange}
            />
            {this.authenticationProviderError && (
              <Label basic color="red" pointing className="float-left mb2">
                {this.authenticationProviderError}
              </Label>
            )}
          </Form.Field>
        );
      }
      return '';
    };

    const collectUserNamePassword = this.props.authentication.shouldCollectUserNamePassword;
    const renderBrandingLogo = <Image centered src={this.props.assets.images.loginImage} />;
    return (
      <div className="login-form animated fadeIn">
        <Grid textAlign="center" style={{ height: '100%' }} verticalAlign="middle">
          <Grid.Column style={{ maxWidth: 450 }}>
            <Form
              error={error}
              size="large"
              loading={this.loading}
              onSubmit={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Segment stacked>
                {renderBrandingLogo}
                <Header as="h3" textAlign="center">
                  {branding.login.title}
                  <Header.Subheader>{branding.login.subtitle}</Header.Subheader>
                </Header>

                {renderAuthenticationProviders()}

                {collectUserNamePassword && (
                  <Form.Field error={!!this.usernameError} required>
                    <Input
                      fluid
                      icon="user"
                      iconPosition="left"
                      placeholder="Username"
                      data-testid="username"
                      value={this.username}
                      onChange={this.handleChange('username')}
                    />
                    {this.usernameError && (
                      <Label basic color="red" pointing className="float-left mb2">
                        {this.usernameError}
                      </Label>
                    )}
                  </Form.Field>
                )}

                {collectUserNamePassword && (
                  <Form.Field error={!!this.passwordError} required>
                    <Input
                      fluid
                      icon="lock"
                      iconPosition="left"
                      placeholder="Password"
                      data-testid="password"
                      value={this.password}
                      type="password"
                      onChange={this.handleChange('password')}
                    />
                    {this.passwordError && (
                      <Label basic color="red" pointing className="float-left mb2">
                        {this.passwordError}
                      </Label>
                    )}
                  </Form.Field>
                )}

                <Button
                  data-testid="login"
                  type="submit"
                  color="blue"
                  fluid
                  basic
                  size="large"
                  className="mb2"
                  onClick={this.handleLogin}
                >
                  Login
                </Button>
              </Segment>
            </Form>
          </Grid.Column>
        </Grid>
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(Login, {
  username: observable,
  password: observable,
  loading: observable,
  authenticationProviderError: observable,
  usernameError: observable,
  passwordError: observable,
  authProviderOptions: computed,
});

export default inject(
  'authentication',
  'authenticationProviderPublicConfigsStore',
  'assets',
)(withRouter(observer(Login)));
