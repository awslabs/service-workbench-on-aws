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
import { decorate, action } from 'mobx';
import { Button, Header } from 'semantic-ui-react';

import { displaySuccess, displayError } from '@amzn/base-ui/dist//helpers/notification';

import Form from '@amzn/base-ui/dist/parts/helpers/fields/Form';
import Input from '@amzn/base-ui/dist/parts/helpers/fields/Input';
import BasicProgressPlaceholder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';
import { isStoreError, isStoreLoading } from '@amzn/base-ui/dist/models/BaseStore';
import DropDown from '@amzn/base-ui/dist/parts/helpers/fields/DropDown';
import { createLink } from '@amzn/base-ui/dist/helpers/routing';
import getBudgetForm from '../../models/forms/AddBudgetForm';

// expected props
// - awsAccount (pass in from AwsAccountList cell click)
// - awsAccountsStore (from injection)
class UpdateBudget extends React.Component {
  constructor(props) {
    super(props);
    this.awsAccountUUID = (this.props.match.params || {}).id;
    this.budgetStore = this.props.awsAccountsStore.getBudgetStore(this.awsAccountUUID);
  }

  render() {
    let content;
    if (isStoreError(this.budgetStore)) {
      content = <ErrorBox error={this.budgetStore.error} className="p0 mb3" />;
    } else if (isStoreLoading(this.budgetStore)) {
      content = <BasicProgressPlaceholder />;
    } else {
      content = this.renderMain();
    }
    return (
      <div className="mt2 animated fadeIn">
        <Header as="h2" icon textAlign="center" className="mt3" color="grey">
          Budget Detail
        </Header>
        <div className="mt3 ml3 mr3 animated fadeIn">{content}</div>
      </div>
    );
  }

  renderMain() {
    const budget = this.budgetStore.budget;

    const form = getBudgetForm(budget);
    const thresholdsOptions = this.budgetStore.thresholdsOptions;
    return (
      <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleFormSubmission}>
        {({ processing, onCancel }) => (
          <>
            <Input field={form.$('budgetLimit')} type="number" />
            <Input field={form.$('startDate')} type="date" />
            <Input field={form.$('endDate')} type="date" />
            <DropDown field={form.$('thresholds')} options={thresholdsOptions} multiple selection clearable fluid />
            <Input field={form.$('notificationEmail')} type="email" />
            <div className="mt3">
              <Button
                floated="right"
                primary
                className="ml2"
                type="submit"
                content="Update Budget"
                disabled={processing}
              />
              <Button floated="right" onClick={onCancel} content="Cancel" disabled={processing} />
            </div>
          </>
        )}
      </Form>
    );
  }

  componentDidMount = async () => {
    try {
      await this.budgetStore.load();
    } catch (error) {
      displayError(error);
    }
  };

  // Private methods
  handleCancel = () => {
    this.goBackToAccountsPage();
  };

  handleFormSubmission = async form => {
    try {
      const values = this.convertDateToEpoch(form.values());
      await this.budgetStore.createOrUpdateBudget(values);
      form.clear();
      displaySuccess('Updated budget successfully');
      this.goBackToAccountsPage();
    } catch (error) {
      displayError(error);
    }
  };

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  goBackToAccountsPage() {
    this.budgetStore.cleanup();
    this.goto('/accounts');
  }

  convertDateToEpoch(values) {
    // Divided by 1000 to convert from milliseconds to seconds
    values.startDate = new Date(values.startDate).getTime() / 1000;
    values.endDate = new Date(values.endDate).getTime() / 1000;
    return values;
  }
}

// decorate is a new API introduced by Mobx4, that allows usage of decorators without the decorator annotations
decorate(UpdateBudget, {
  handleCancel: action,
  handleFormSubmission: action,
});

export default inject('awsAccountsStore')(observer(UpdateBudget));
