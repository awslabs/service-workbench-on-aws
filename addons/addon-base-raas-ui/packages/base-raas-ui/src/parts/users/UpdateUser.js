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
import { decorate, observable, action, computed, runInAction } from 'mobx';
import { Button, Header, Label, Segment, Modal, Menu, Icon, Table } from 'semantic-ui-react';
import _ from 'lodash';

import Stores from '@aws-ee/base-ui/dist/models/Stores';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';

import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import YesNo from '@aws-ee/base-ui/dist/parts/helpers/fields/YesNo';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { getUpdateUserConfigForm } from '../../models/forms/UpdateUserConfig';
import { toIdpFromValue, toIdpOptions } from '../../models/forms/UserFormUtils';

class UpdateUser extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([
        this.userStore,
        this.userRolesStore,
        this.awsAccountsStore,
        this.projectsStore,
        this.authenticationProviderConfigsStore,
      ]);
      this.modalOpen = false;
      this.processing = false;
      this.view = 'detail'; // view mode or edit mode
    });
    this.form = getUpdateUserConfigForm(this.getCurrentUser());
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

    return (
      <Modal closeIcon trigger={this.renderTrigger()} open={this.modalOpen} onClose={this.handleClose}>
        <div className="mt2 animated fadeIn">
          <Header as="h3" icon textAlign="center" className="mt3" color="grey">
            User Detail
          </Header>
          <div className="mt3 ml3 mr3 animated fadeIn">{content}</div>
        </div>
      </Modal>
    );
  }

  renderMain() {
    let content = null;
    if (this.view === 'detail') {
      content = this.renderDetailView();
    } else if (this.view === 'edit') {
      content = this.renderEditView();
    }
    return content;
  }

  renderDetailView() {
    const getFieldLabel = fieldName => this.form.$(fieldName).label;
    const toRow = fieldName => {
      const value = _.get(this.getCurrentUser(), fieldName);
      const displayValue = _.isArray(value) ? _.map(value, (v, k) => <Label key={k} content={v} />) : value;
      return (
        <>
          <Table.Cell collapsing active>
            {getFieldLabel(fieldName)}
          </Table.Cell>
          <Table.Cell>{displayValue}</Table.Cell>
        </>
      );
    };

    return (
      <Segment basic className="ui fluid form mb4">
        <Table celled>
          <Table.Body>
            <Table.Row>{toRow('username')}</Table.Row>
            <Table.Row>{toRow('firstName')}</Table.Row>
            <Table.Row>{toRow('lastName')}</Table.Row>
            <Table.Row>{toRow('email')}</Table.Row>
            <>
              <Table.Row>{toRow('userRole')}</Table.Row>
              <Table.Row>{toRow('identityProviderName')}</Table.Row>
              <Table.Row>{toRow('projectId')}</Table.Row>
              {this.getCurrentUser().status === 'pending' && <Table.Row>{toRow('applyReason')}</Table.Row>}
              <Table.Row>{toRow('status')}</Table.Row>
            </>
          </Table.Body>
        </Table>
        {this.renderDetailViewButtons()}
      </Segment>
    );
  }

  renderDetailViewButtons() {
    const makeButton = ({ label = '', color = 'blue', floated = 'left', disabled = false, ...props }) => {
      const attrs = {};
      if (color) attrs.color = color;
      return (
        <Button floated={floated} disabled={disabled} className="ml2" {...attrs} {...props}>
          {label}
        </Button>
      );
    };

    const currentUser = this.getCurrentUser();

    const cancelButton = makeButton({
      label: 'Cancel',
      floated: 'left',
      color: '',
      onClick: this.handleCancel,
      disabled: this.processing,
    });

    const activeButton =
      this.props.user.status === 'pending' || this.props.user.status === 'inactive'
        ? makeButton({
            label: 'Activate User',
            floated: 'right',
            color: 'blue',
            onClick: () => this.handleApproveDisapproveClick('active'),
            disabled: this.processing,
          })
        : '';

    const deactiveButton =
      this.props.user.status === 'active' || this.props.user.status === 'pending'
        ? makeButton({
            label: 'Deactivate User',
            floated: 'right',
            disabled: this.processing,
            onClick: () => this.handleApproveDisapproveClick('inactive'),
          })
        : '';

    const editButton =
      currentUser.status === 'active' || currentUser.status === 'inactive' // do not show "edit" button for other status(es) such as "pending"
        ? makeButton({ label: 'Edit', onClick: this.handleEditClick, floated: 'right', disabled: this.processing })
        : '';

    return this.props.adminMode ? (
      <div className="mt4 mb4">
        <Modal.Actions>
          {cancelButton}
          {deactiveButton}
          {activeButton}
          {editButton}
        </Modal.Actions>
      </div>
    ) : (
      <div className="mt4 mb4">
        <Modal.Actions>
          {cancelButton}
          {editButton}
        </Modal.Actions>
      </div>
    );
  }

  renderEditView() {
    const form = this.form;

    const firstNameField = form.$('firstName');
    const lastNameField = form.$('lastName');
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

    const isAdminMode = this.props.adminMode;
    return (
      <Segment clearing className="p3 mb4">
        <Form
          form={form}
          onCancel={this.handleCancel}
          onSuccess={this.handleFormSubmission}
          onError={this.handleFormError}
        >
          {({ processing, onCancel }) => (
            <>
              <Input field={firstNameField} disabled={processing} />
              <Input field={lastNameField} disabled={processing} />
              <Input field={emailField} disabled={processing} />
              <>
                {isAdminMode && (
                  <DropDown
                    field={identityProviderNameField}
                    options={identityProviderOptions}
                    selection
                    fluid
                    disabled={processing}
                  />
                )}
                {isAdminMode && (
                  <DropDown field={userRoleField} options={userRoleOptions} selection fluid disabled={processing} />
                )}

                {isAdminMode && showProjectField && (
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
              </>

              <div className="mt3">
                <Button floated="right" color="blue" icon disabled={processing} className="ml2" type="submit">
                  Save
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

  renderTrigger() {
    let content = null;
    if (this.props.adminMode) {
      content = (
        <Button size="mini" compact color="blue" onClick={this.handleOpen}>
          Detail
        </Button>
      );
    } else {
      content = (
        <Menu.Item onClick={this.handleOpen}>
          <Icon name="user" /> {this.props.userStore.user.displayName}
        </Menu.Item>
      );
    }
    return content;
  }

  handleEditClick = () => {
    this.view = 'edit';
  };

  handleCancel = () => {
    this.form.clear();
    if (this.view === 'edit') {
      // if it's in edit mode then switch to detail view mode
      this.view = 'detail';
    } else {
      // if not in edit mode then close
      this.handleClose();
    }
  };

  handleFormSubmission = async form => {
    const values = form.values();
    const isInternalUser = this.userRolesStore.isInternalUser(values.userRole);
    const isInternalGuest = this.userRolesStore.isInternalGuest(values.userRole);
    let projectId = values.projectId || [];
    if (!isInternalUser || isInternalGuest) {
      // Pass projectId(s) only if the user's role is internal role and if the user is not a guest.
      // Pass empty array otherwise.
      projectId = [];
    }

    const { firstName, lastName, email, userRole, status } = values;
    const isAdmin = userRole === 'admin';
    const identityProviderNameField = form.$('identityProviderName');

    let userToUpdate = { ...this.getCurrentUser(), firstName, lastName, email };
    if (this.props.adminMode) {
      userToUpdate = { ...userToUpdate, userRole, isAdmin, projectId, status };
    }

    try {
      const usersStore = this.usersStore;
      if (identityProviderNameField.isDirty) {
        // Change in identityProviderName so delete existing user and add it again with new identityProviderName
        if (this.props.adminMode) {
          // clear out the user namespace as it will be re-derived based on authenticationProviderId and
          // identityProviderName on server side
          userToUpdate.ns = undefined;
          // The values.identityProviderName is in JSON string format
          // containing authentication provider id as well as identity provider name
          // See "src/models/forms/UserFormUtils.js" for more details.
          const idpOptionValue = toIdpFromValue(identityProviderNameField.value);
          userToUpdate.identityProviderName = idpOptionValue.idpName;
          userToUpdate.authenticationProviderId = idpOptionValue.authNProviderId;
          await usersStore.addUser(userToUpdate);

          // Delete existing user first
          await usersStore.deleteUser(this.getCurrentUser());
        } else {
          displayError('Only admins can update identity provider information for the user');
        }
      } else {
        // No change in identityProviderName so simply update the user

        // allow updating only firstName, lastName and email in case self-service update (i.e., adminMode = false)
        // or if the user being updated is a root user (i.e., this.getCurrentUser().isRootUser = true)
        await usersStore.updateUser(userToUpdate);
      }
      form.clear();
      displaySuccess('Updated user successfully');

      // reload the current user's store after user updates, in case the currently
      // logged in user is updated
      await this.userStore.load();

      this.handleClose();
    } catch (error) {
      displayError(error);
    }
  };

  handleApproveDisapproveClick = async status => {
    try {
      this.processing = true;
      await this.usersStore.updateUser({ ...this.getCurrentUser(), status });

      // reload the current user's store after user updates, in case the currently
      // logged in user is updated
      await this.userStore.load();
    } catch (err) {
      displayError(err);
    }
    runInAction(() => {
      this.processing = false;
    });
    this.handleClose();
  };

  getStores() {
    return this.stores;
  }

  handleOpen = () => {
    this.usersStore.stopHeartbeat();

    // Need to recreate form based on the user being passed (i.e., getCurrentUser) to make sure the form field values
    // are updated as per the latest user information
    this.form = getUpdateUserConfigForm(this.getCurrentUser());
    this.modalOpen = true;
  };

  handleClose = () => {
    this.usersStore.startHeartbeat();
    this.modalOpen = false;
  };

  // eslint-disable-next-line no-unused-vars
  handleFormError = (_form, _errors) => {
    // We don't need to do anything here
  };

  getIdentityProviderOptions() {
    return toIdpOptions(this.authenticationProviderConfigsStore.list);
  }

  getUserRoleOptions() {
    return this.userRolesStore.dropdownOptions;
  }

  getProjectOptions() {
    return this.projectsStore.dropdownOptions;
  }

  getCurrentUser() {
    return this.props.user;
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
decorate(UpdateUser, {
  modalOpen: observable,
  view: observable,
  processing: observable,

  authenticationProviderConfigsStore: computed,
  projectsStore: computed,
  awsAccountsStore: computed,
  userRolesStore: computed,
  usersStore: computed,
  userStore: computed,

  handleOpen: action,
  handleClose: action,
  handleCancel: action,

  handleEditClick: action,
  handleDeleteClick: action,
  handleApproveDisapproveClick: action,

  handleFormSubmission: action,
});
export default inject('authenticationProviderConfigsStore')(observer(UpdateUser));
