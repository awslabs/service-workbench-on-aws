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
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { decorate, observable, action, runInAction } from 'mobx';
import { Button, Dimmer, Header, List, Loader, Radio, Segment } from 'semantic-ui-react';
import _ from 'lodash';

import { getAddUserForm, getAddUserFormFields } from '../../models/forms/AddUserForm';
import { displayError } from '../../helpers/notification';
import { createLink } from '../../helpers/routing';
import validate from '../../models/forms/Validate';

class AddUser extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      role: 'guest',
      status: 'active',
      identityProviderName: 'auth0',
      projectId: [],
      userRole: '',
    };
    runInAction(() => {
      this.formProcessing = false;
      this.validationErrors = new Map();
      this.user = {};
    });
    this.form = getAddUserForm();
    this.addUserFormFields = getAddUserFormFields();
  }

  render() {
    return (
      <div className="mt2 animated fadeIn">
        <Header as="h2" icon textAlign="center" className="mt3" color="grey">
          Add User
        </Header>
        <div className="mt3 ml3 mr3 animated fadeIn">{this.renderAddUserForm()}</div>
      </div>
    );
  }

  handleRoleChange = (e, { value }) =>
    this.setState({
      role: value,
    });

  handleStatusChange = (e, { value }) =>
    this.setState({
      status: value,
    });

  handleIdentityProviderName = (e, { value }) =>
    this.setState({
      identityProviderName: value,
    });

  handleRaasProjectId = (e, { value }) =>
    this.setState({
      projectId: value,
    });

  renderIdentityProviderNameSelection() {
    const identityProviderOption = [
      {
        key: 'auth0',
        text: 'Auth0 Database',
        value: 'auth0',
      },
      {
        key: 'google-oauth2',
        text: 'Google',
        value: 'google-oauth2',
      },
    ];
    return <Dropdown options={identityProviderOption} fluid selection onChange={this.handleIdentityProviderName} />;
  }

  renderAddUserForm() {
    const processing = this.formProcessing;
    const fields = this.addUserFormFields;
    const toEditableInput = (attributeName, type = 'text') => {
      const handleChange = action(event => {
        event.preventDefault();
        this.user[attributeName] = event.target.value;
      });
      return (
        <div className="ui focus input">
          <input
            type={type}
            defaultValue={this.user[attributeName]}
            placeholder={fields[attributeName].placeholder || ''}
            onChange={handleChange}
          />
        </div>
      );
    };
    const toRadioGroupInput = ({
      attributeName,
      radioOptions,
      defaultSelected,
      isBooleanInput = true,
      trueValue = 'yes',
    }) => {
      const handleChange = () =>
        action((event, { value }) => {
          if (isBooleanInput) {
            this.user[attributeName] = value === trueValue;
          } else {
            this.user[attributeName] = value;
          }
          event.stopPropagation();
        });
      let count = 0;
      return (
        <span>
          {_.map(radioOptions, radioOption => {
            return (
              <Radio
                key={++count}
                className="ml1"
                name={attributeName}
                checked={defaultSelected === radioOption.value}
                value={radioOption.value}
                label={radioOption.label}
                onChange={handleChange()}
              />
            );
          })}
        </span>
      );
    };

    return (
      <Segment basic className="ui fluid form">
        <Dimmer active={processing} inverted>
          <Loader inverted>Checking</Loader>
        </Dimmer>

        {this.renderField('username', toEditableInput('username'))}
        <div className="mb4" />

        {this.renderField('password', toEditableInput('password', 'password'))}
        <div className="mb4" />

        {this.renderField('email', toEditableInput('email', 'email'))}
        <div className="mb4" />

        {this.renderField('firstName', toEditableInput('firstName'))}
        <div className="mb4" />

        {this.renderField('lastName', toEditableInput('lastName'))}
        <div className="mb4" />

        {this.renderField(
          'isAdmin',
          toRadioGroupInput({
            attributeName: 'isAdmin',
            defaultSelected: this.user.isAdmin ? 'yes' : 'no',
            isBooleanInput: true,
            radioOptions: [
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ],
          }),
        )}
        <div className="mb4" />

        {this.renderField(
          'status',
          toRadioGroupInput({
            attributeName: 'status',
            defaultSelected: this.user.status || 'active',
            isBooleanInput: false,
            radioOptions: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          }),
        )}
        <div className="mb4" />

        {this.renderButtons()}
      </Segment>
    );
  }

  renderButtons() {
    const processing = this.formProcessing;
    return (
      <div className="mt3">
        <Button floated="right" color="blue" icon disabled={processing} className="ml2" onClick={this.handleSubmit}>
          Add User
        </Button>
        <Button floated="right" disabled={processing} onClick={this.handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  renderField(name, component) {
    const fields = this.addUserFormFields;
    const explain = fields[name].explain;
    const label = fields[name].label;
    const hasExplain = !_.isEmpty(explain);
    const fieldErrors = this.validationErrors.get(name);
    const hasError = !_.isEmpty(fieldErrors);

    return (
      <div>
        <Header className="mr3 mt0" as="h2" color="grey">
          {label}
        </Header>
        {hasExplain && <div className="mb2">{explain}</div>}
        <div className={`ui big field input block m0 ${hasError ? 'error' : ''}`}>{component}</div>
        {hasError && (
          <div className="ui pointing red basic label">
            <List>
              {_.map(fieldErrors, fieldError => (
                <List.Item key={name}>
                  <List.Content>{fieldError}</List.Content>
                </List.Item>
              ))}
            </List>
          </div>
        )}
      </div>
    );
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  handleCancel = action(event => {
    event.preventDefault();
    event.stopPropagation();
    this.formProcessing = false;
    this.goto('/users');
  });

  handleSubmit = action(async () => {
    this.formProcessing = true;
    try {
      // Perform client side validations first
      const validationResult = await validate(this.user, this.addUserFormFields);
      // if there are any client side validation errors then do not attempt to make API call
      if (validationResult.fails()) {
        runInAction(() => {
          this.validationErrors = validationResult.errors;
          this.formProcessing = false;
        });
      } else {
        // There are no client side validation errors so ask the store to add user (which will make API call to server to add the user)
        await this.getStore().addUser(this.user);
        runInAction(() => {
          this.formProcessing = false;
        });
        this.goto('/users');
      }
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(error);
    }
  });

  getStore() {
    return this.props.usersStore;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AddUser, {
  formProcessing: observable,
  user: observable,
  validationErrors: observable,
});
export default inject('userStore', 'usersStore')(withRouter(observer(AddUser)));
