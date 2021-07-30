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
  getBaseAddUpdateAwsAccountFormFields,
  getAddUpdateAwsAccountAppStreamFormFields,
  getAddUpdateAwsAccountForm,
} from '../../models/forms/AddUpdateAwsAccountForm';

class AddUpdateAwsAccount extends React.Component {
  PAGE_TYPE_UPDATE = 'UPDATE';

  PAGE_TYPE_ADD = 'ADD';

  constructor(props) {
    super(props);
    this.state = {
      // eslint-disable-next-line react/no-unused-state
      role: 'guest',
      // eslint-disable-next-line react/no-unused-state
      status: 'active',
    };

    runInAction(() => {
      this.formProcessing = false;
      this.validationErrors = new Map();
      this.awsAccount = {};
      this.awsAccountUUID = _.get(this.props, 'match.params.id', undefined);
      this.rev = _.get(this.props, 'match.params.rev', undefined);
      this.pageType = this.awsAccountUUID ? this.PAGE_TYPE_UPDATE : this.PAGE_TYPE_ADD;
    });

    let fields = {};
    if (this.pageType === this.PAGE_TYPE_ADD) {
      fields = getBaseAddUpdateAwsAccountFormFields();
    }
    if (process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true') {
      fields = { ...fields, ...getAddUpdateAwsAccountAppStreamFormFields() };
    }
    this.form = getAddUpdateAwsAccountForm(fields);
    this.addUpdateAwsAccountFormFields = fields;
  }

  render() {
    return (
      <div className="mt2 animated fadeIn">
        <Header as="h2" icon textAlign="center" className="mt3" color="grey">
          {this.pageType === this.PAGE_TYPE_ADD ? 'Add' : 'Update'} AWS Account
        </Header>
        <div className="mt3 ml3 mr3 animated fadeIn">{this.renderAddAwsAccountForm()}</div>
      </div>
    );
  }

  // eslint-disable-next-line react/no-unused-state
  handleRoleChange = (e, { value }) => this.setState({ role: value });

  // eslint-disable-next-line react/no-unused-state
  handleStatusChange = (e, { value }) => this.setState({ status: value });

  renderAddAwsAccountForm() {
    const processing = this.formProcessing;
    const fields = this.addUpdateAwsAccountFormFields;
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
          Onboard AWS Account
        </Button>
        <Button floated="right" disabled={processing} onClick={this.handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  renderField(name, component) {
    const fields = this.addUpdateAwsAccountFormFields;
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
      const validationResult = await validate(this.awsAccount, this.addUpdateAwsAccountFormFields);
      // if there are any client side validation errors then do not attempt to make API call
      if (validationResult.fails()) {
        runInAction(() => {
          this.validationErrors = validationResult.errors;
          this.formProcessing = false;
        });
      } else {
        let id = '';
        if (this.pageType === this.PAGE_TYPE_ADD) {
          const account = await this.props.awsAccountsStore.addAwsAccount(this.awsAccount);
          id = account.id;
        } else {
          await this.props.awsAccountsStore.updateAwsAccount(this.awsAccountUUID, {
            ...this.awsAccount,
            rev: Number(this.rev),
          });
          id = this.awsAccountUUID;
        }
        runInAction(() => {
          this.formProcessing = false;
        });
        this.goto(`/aws-accounts/onboard/${id}`);
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
decorate(AddUpdateAwsAccount, {
  formProcessing: observable,
  user: observable,
  validationErrors: observable,
});
export default inject('usersStore', 'awsAccountsStore')(withRouter(observer(AddUpdateAwsAccount)));
