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
import { computed, decorate, observable, runInAction, action } from 'mobx';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Header, Icon, Message, Segment, Button } from 'semantic-ui-react';

import { displaySuccess, displayError } from '@aws-ee/base-ui/dist//helpers/notification';
import Stores from '@aws-ee/base-ui/dist/models/Stores';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import YesNo from '@aws-ee/base-ui/dist/parts/helpers/fields/YesNo';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';

import { isStoreLoading, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import { getAddUserForm } from '../../models/forms/AddLocalUserForm';

// expected props
// - projectsStore (via injection)
// - userRolesStore (via injection)
// - usersStore (via injection)
class AddSingleLocalUser extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([this.userRolesStore, this.projectsStore]);
      this.form = getAddUserForm();
    });
  }

  componentDidMount() {
    swallowError(this.stores.load());
  }

  get projectsStore() {
    return this.props.projectsStore;
  }

  get userRolesStore() {
    return this.props.userRolesStore;
  }

  get usersStore() {
    return this.props.usersStore;
  }

  // Private methods
  handleCancel = () => {
    const goto = gotoFn(this);
    goto('/users');
  };

  handleFormSubmission = async form => {
    const values = form.values();
    const isInternalUser = this.userRolesStore.isInternalUser(values.userRole);
    const isInternalGuest = this.userRolesStore.isInternalGuest(values.userRole);

    let projectId = values.projectId || [];
    if (!isInternalUser || isInternalGuest) {
      // Pass projectId(s) only if it is internal user or a guest. Pass empty array otherwise.
      projectId = [];
    }

    try {
      await this.usersStore.addUser({ ...values, projectId });
      runInAction(() => {
        form.clear();
      });
      displaySuccess('Added local user successfully');

      const goto = gotoFn(this);
      goto('/users');
    } catch (error) {
      displayError(error);
    }
  };

  render() {
    const stores = this.stores;
    let content = null;
    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0 mb3" />;
    } else if (isStoreLoading(stores)) {
      content = <BasicProgressPlaceholder />;
    } else if (isStoreReady(stores)) {
      content = this.renderContent();
    } else {
      content = null;
    }

    return (
      <Container className="mt3 mb4">
        {this.renderTitle()}
        {this.renderWarning()}
        {content}
      </Container>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="user" className="align-top" />
          <Header.Content className="left-align">Add Local User</Header.Content>
        </Header>
      </div>
    );
  }

  renderContent() {
    const form = this.form;
    const emailField = form.$('email');
    const firstNameField = form.$('firstName');
    const lastNameField = form.$('lastName');
    const passwordField = form.$('password');
    const userRoleField = form.$('userRole');
    const projectIdField = form.$('projectId');
    const statusField = form.$('status');

    const userRoleOptions = this.userRolesStore.dropdownOptions;
    const projectIdOptions = this.projectsStore.dropdownOptions;

    const isInternalUser = this.userRolesStore.isInternalUser(userRoleField.value);
    const isInternalGuest = this.userRolesStore.isInternalGuest(userRoleField.value);
    const showProjectField = !_.isEmpty(projectIdOptions) && isInternalUser && !isInternalGuest;
    const showProjectWarning = _.isEmpty(projectIdOptions) && isInternalUser && !isInternalGuest;

    return (
      <Segment clearing className="p3">
        <Form form={form} onCancel={this.handleCancel} onSuccess={this.handleFormSubmission}>
          {({ processing, onCancel }) => (
            <>
              <Input field={emailField} disabled={processing} />
              <Input field={firstNameField} disabled={processing} />
              <Input field={lastNameField} disabled={processing} />
              <Input field={passwordField} type="password" disabled={processing} />
              <DropDown field={userRoleField} options={userRoleOptions} selection fluid disabled={processing} />

              {showProjectField && (
                <DropDown
                  field={projectIdField}
                  options={projectIdOptions}
                  multiple
                  selection
                  clearable
                  fluid
                  disabled={processing}
                />
              )}

              {showProjectWarning && (
                <Message
                  className="mb4"
                  icon="warning"
                  header="Missing projects"
                  content="There are no projects created. Once you create a project or two. You want to come back and associate this user to at least one project. You can still create the user for now."
                />
              )}

              <YesNo field={statusField} disabled={processing} />

              <div className="mt3">
                <Button floated="right" color="blue" icon disabled={processing} className="ml2" type="submit">
                  Add Local User
                </Button>
                <Button floated="right" disabled={processing} onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Form>
      </Segment>
    );
  }

  renderWarning() {
    return (
      <Message
        warning
        icon="warning"
        header="Not for production usage"
        content="Creating local users is not meant to be used in production environments."
      />
    );
  }
}

decorate(AddSingleLocalUser, {
  projectsStore: computed,
  userRolesStore: computed,
  usersStore: computed,
  stores: observable,
  form: observable,
  handleCancel: action,
  handleFormSubmission: action,
});

export default inject('projectsStore', 'userRolesStore', 'usersStore')(withRouter(observer(AddSingleLocalUser)));
