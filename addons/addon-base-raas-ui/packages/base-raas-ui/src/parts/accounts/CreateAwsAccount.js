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
import { Button, Dimmer, Header, List, Loader, Segment } from 'semantic-ui-react';
import _ from 'lodash';

import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import validate from '@aws-ee/base-ui/dist/models/forms/Validate';

import {
  getCreateAwsAccountForm,
  getCreateBaseAwsAccountFormFields,
  getCreateAwsAccountAppStreamFormFields,
} from '../../models/forms/CreateAwsAccountForm';

class CreateAwsAccount extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.formProcessing = false;
      this.validationErrors = new Map();
      this.awsAccount = {};
    });

    let fields = getCreateBaseAwsAccountFormFields();
    if (process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true') {
      fields = { ...fields, ...getCreateAwsAccountAppStreamFormFields() };
    }
    this.form = getCreateAwsAccountForm(fields);
    this.createAwsAccountFormFields = fields;
  }

  render() {
    return (
      <div className="mt2 animated fadeIn">
        <Header as="h2" icon textAlign="center" className="mt3" color="grey">
          Create AWS Account
        </Header>
        <div className="mt3 ml3 mr3 animated fadeIn">{this.renderCreateAwsAccountForm()}</div>
      </div>
    );
  }

  // eslint-disable-next-line react/no-unused-state
  handleRoleChange = (e, { value }) => this.setState({ role: value });

  // eslint-disable-next-line react/no-unused-state
  handleStatusChange = (e, { value }) => this.setState({ status: value });

  renderCreateAwsAccountForm() {
    const processing = this.formProcessing;
    const fields = this.createAwsAccountFormFields;
    const toEditableInput = (attributeName, type = 'text') => {
      const handleChange = action(event => {
        event.preventDefault();
        this.awsAccount[attributeName] = event.target.value;
      });
      return (
        <div className="ui focus input">
          <input
            type={type}
            defaultValue={this.awsAccount[attributeName]}
            placeholder={fields[attributeName].placeholder || ''}
            onChange={handleChange}
          />
        </div>
      );
    };

    return (
      <Segment basic className="ui fluid form">
        <Dimmer active={processing} inverted>
          <Loader inverted>Checking</Loader>
        </Dimmer>
        {Object.keys(fields).map(field => (
          <React.Fragment key={field}>
            {this.renderField(field, toEditableInput(field))}
            <div className="mb4" />
          </React.Fragment>
        ))}
        {this.renderButtons()}
      </Segment>
    );
  }

  renderButtons() {
    const processing = this.formProcessing;
    return (
      <div className="mt3">
        <Button floated="right" color="blue" icon disabled={processing} className="ml2" onClick={this.handleSubmit}>
          Create AWS Account
        </Button>
        <Button floated="right" disabled={processing} onClick={this.handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  renderField(name, component) {
    const fields = this.createAwsAccountFormFields;
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
    this.goto('/accounts');
  });

  handleSubmit = action(async () => {
    this.formProcessing = true;
    try {
      // Perform client side validations first
      const validationResult = await validate(this.awsAccount, this.createAwsAccountFormFields);
      // if there are any client side validation errors then do not attempt to make API call
      if (validationResult.fails()) {
        runInAction(() => {
          this.validationErrors = validationResult.errors;
          this.formProcessing = false;
        });
      } else {
        // There are no client side validation errors so ask the store to add user (which will make API call to server to add the user)
        await this.props.awsAccountsStore.createAwsAccount(this.awsAccount);
        runInAction(() => {
          this.formProcessing = false;
        });
        this.goto('/accounts');
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
decorate(CreateAwsAccount, {
  formProcessing: observable,
  user: observable,
  validationErrors: observable,
});
export default inject('usersStore', 'awsAccountsStore')(withRouter(observer(CreateAwsAccount)));
