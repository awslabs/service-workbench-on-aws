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
import _ from 'lodash';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { decorate, computed, runInAction } from 'mobx';
import { Segment, Button } from 'semantic-ui-react';

import { displaySuccess, displayError } from '@aws-ee/base-ui/dist//helpers/notification';

import Stores from '@aws-ee/base-ui/dist/models/Stores';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import YesNo from '@aws-ee/base-ui/dist/parts/helpers/fields/YesNo';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import { getAddUserForm, getAddUserFormFields } from '../../models/forms/AddUserForm';
import { toIdpFromValue, toIdpOptions } from '../../models/forms/UserFormUtils';

// expected props
// - userStore (via injection)
// - usersStore (via injection)
// - userRolesStore (via injection)
// - awsAccountsStore (via injection)
// - projectsStore (via injection)
// - authenticationProviderConfigsStore (via injection)
class AddSingleUser extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([
        this.userStore,
        this.usersStore,
        this.userRolesStore,
        this.awsAccountsStore,
        this.projectsStore,
        this.authenticationProviderConfigsStore,
      ]);
    });
    this.form = getAddUserForm();
    this.addUserFormFields = getAddUserFormFields();
  }

  componentDidMount() {
    swallowError(this.getStores().load());
  }

  render() {
    const stores = this.getStores();
    let content = null;
    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0 mb3" />;
    } else if (stores.loading) {
      content = <BasicProgressPlaceholder />;
    } else if (stores.ready) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return content;
  }

  renderMain() {
    const form = this.form;
    const emailField = form.$('email');
    const identityProviderNameField = form.$('identityProviderName');
    const userRoleField = form.$('userRole');
    const projectIdField = form.$('projectId');
    const statusField = form.$('status');

    const identityProviderOptions = this.getIdentityProviderOptions();
    const userRoleOptions = this.getUserRoleOptions();
    const projectIdOptions = this.getProjectOptions();

    const isInternalUser = this.userRolesStore.isInternalUser(userRoleField.value);
    const isInternalGuest = this.userRolesStore.isInternalGuest(userRoleField.value);
    const showProjectField = !_.isEmpty(projectIdOptions) && isInternalUser && !isInternalGuest;

    return (
      <Segment clearing className="p3">
        <Form
          form={form}
          onCancel={this.handleCancel}
          onSuccess={this.handleFormSubmission}
          onError={this.handleFormError}
        >
          {({ processing, _onSubmit, onCancel }) => (
            <>
              <Input field={emailField} disabled={processing} />
              <DropDown
                field={identityProviderNameField}
                options={identityProviderOptions}
                selection
                fluid
                disabled={processing}
              />
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

              <YesNo field={statusField} disabled={processing} />

              <div className="mt3">
                <Button floated="right" color="blue" icon disabled={processing} className="ml2" type="submit">
                  Add User
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

  getIdentityProviderOptions() {
    return toIdpOptions(this.authenticationProviderConfigsStore.list);
  }

  getUserRoleOptions() {
    return this.userRolesStore.dropdownOptions;
  }

  getProjectOptions() {
    return this.projectsStore.dropdownOptions;
  }

  // Private methods
  handleCancel = () => {
    const goto = gotoFn(this);
    goto('/users');
  };

  handleFormSubmission = async (form) => {
    const values = form.values();
    const isInternalUser = this.userRolesStore.isInternalUser(values.userRole);
    const isInternalGuest = this.userRolesStore.isInternalGuest(values.userRole);
    let projectId = values.projectId || [];
    if (!isInternalUser || isInternalGuest) {
      // Pass projectId(s) only if the user's role is internal role and if the user is not a guest.
      // Pass empty array otherwise.
      projectId = [];
    }

    // The values.identityProviderName is in JSON string format
    // containing authentication provider id as well as identity provider name
    // See "src/models/forms/UserFormUtils.js" for more details.
    const idpOptionValue = toIdpFromValue(values.identityProviderName);
    const identityProviderName = idpOptionValue.idpName;
    const authenticationProviderId = idpOptionValue.authNProviderId;

    try {
      await this.usersStore.addUser({ ...values, authenticationProviderId, identityProviderName, projectId });
      form.clear();
      displaySuccess('Added user successfully');

      const goto = gotoFn(this);
      goto('/users');
    } catch (error) {
      displayError(error);
    }
  };

  // eslint-disable-next-line no-unused-vars
  handleFormError = (_form, _errors) => {
    // We don't need to do anything here
  };

  getStores() {
    return this.stores;
  }

  get userStore() {
    return this.props.userStore;
  }

  get usersStore() {
    return this.props.usersStore;
  }

  get userRolesStore() {
    return this.props.userRolesStore;
  }

  get awsAccountsStore() {
    return this.props.awsAccountsStore;
  }

  get projectsStore() {
    return this.props.projectsStore;
  }

  get authenticationProviderConfigsStore() {
    return this.props.authenticationProviderConfigsStore;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AddSingleUser, {
  userStore: computed,
  usersStore: computed,
  userRolesStore: computed,
  awsAccountsStore: computed,
  projectsStore: computed,
  authenticationProviderConfigsStore: computed,
});

export default inject(
  'userStore',
  'usersStore',
  'userRolesStore',
  'awsAccountsStore',
  'projectsStore',
  'authenticationProviderConfigsStore',
)(withRouter(observer(AddSingleUser)));
