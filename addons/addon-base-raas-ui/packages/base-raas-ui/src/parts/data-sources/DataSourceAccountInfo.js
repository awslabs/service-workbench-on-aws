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
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button } from 'semantic-ui-react';

import { displaySuccess, displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';

import { getAccountForm } from '../../models/forms/UpdateRegisteredAccountForm';

// expected props
// - account (via prop)
// - dataSourceAccountsStore (via injection)
class DataSourceAccountInfo extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = getAccountForm(props.account);
    });
  }

  get account() {
    return this.props.account;
  }

  get accountsStore() {
    return this.props.dataSourceAccountsStore;
  }

  getFields(names, container) {
    const form = container || this.form;
    return _.map(names, name => form.$(name));
  }

  handleCancel = () => {
    this.form.reset();
  };

  handleSave = async form => {
    const account = this.account;
    const accountsStore = this.accountsStore;
    const formData = form.values();

    const data = { ...formData, id: account.id, rev: account.rev };
    try {
      await accountsStore.updateAccount(data);
      runInAction(() => {
        this.form = getAccountForm(data);
      });
      displaySuccess('Account information updated successfully');
    } catch (error) {
      displayError(error);
    }
  };

  render() {
    const form = this.form;
    const isDirty = form.isDirty;

    return (
      <div className="animated fadeIn mb3 mt3">
        <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleSave}>
          {({ processing, /* onSubmit, */ onCancel }) => (
            <>
              <Input field={form.$('name')} className="mb3" />
              <TextArea field={form.$('contactInfo')} className="mb3" />
              <TextArea field={form.$('description')} className="mb3" />

              <Button
                floated="right"
                className="ml2"
                primary
                content="Save"
                disabled={processing || !isDirty}
                type="submit"
              />
              <Button
                floated="right"
                className="ml2"
                content="Reset"
                disabled={processing || !isDirty}
                onClick={onCancel}
              />
            </>
          )}
        </Form>
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(DataSourceAccountInfo, {
  accountsStore: computed,
  account: computed,
  form: observable,
  handleCancel: action,
});

export default inject('dataSourceAccountsStore')(withRouter(observer(DataSourceAccountInfo)));
