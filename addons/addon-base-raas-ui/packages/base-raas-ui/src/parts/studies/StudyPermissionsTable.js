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
import { action, decorate, observable, runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { Button, Dimmer, Dropdown, Loader, Icon, Table } from 'semantic-ui-react';

import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreLoading, isStoreNew, stopHeartbeat } from '@aws-ee/base-ui/dist/models/BaseStore';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import UserLabels from '@aws-ee/base-ui/dist/parts/helpers/UserLabels';

// expected props
// - study
// - userStore (via injection)
// - usersStore (via injection)
class StudyPermissionsTable extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.permissionsStore = props.study.getPermissionsStore();
      this.currUser = props.userStore.user;
      this.usersStore = props.usersStore;

      this.resetForm();
    });
  }

  get study() {
    return this.props.study;
  }

  componentDidMount() {
    swallowError(this.permissionsStore.load());
    this.permissionsStore.startHeartbeat();
  }

  componentWillUnmount() {
    stopHeartbeat(this.permissionsStore);
  }

  enableEditMode = () => {
    // Set users who currently have permission to the study as the selected users
    this.study.userTypes.forEach(userType => {
      this.selectedUserIds[userType] = this.permissionsStore.studyPermissions[`${userType}Users`];
    });

    // Show edit dropdowns via observable
    this.editModeOn = true;
  };

  resetForm = () => {
    this.editModeOn = false;
    this.isProcessing = false;
    this.selectedUserIds = {};
  };

  submitUpdate = async () => {
    runInAction(() => {
      this.isProcessing = true;
    });

    // Perform update
    try {
      await this.permissionsStore.update(this.selectedUserIds);
      displaySuccess('Update Succeeded');
      runInAction(() => {
        this.resetForm();
      });
    } catch (error) {
      displayError('Update Failed', error);
      runInAction(() => {
        this.isProcessing = false;
      });
    }
  };

  render() {
    // Render loading, error, or permissions table
    let content;
    if (isStoreError(this.permissionsStore)) {
      content = <ErrorBox error={this.permissionsStore.error} className="mt0" />;
    } else if (isStoreLoading(this.permissionsStore) || isStoreNew(this.permissionsStore)) {
      content = <BasicProgressPlaceholder segmentCount={1} />;
    } else {
      content = this.renderTable();
    }

    return content;
  }

  renderTable() {
    const studyPermissions = this.permissionsStore.studyPermissions;
    const isEditable = studyPermissions.isStudyAdmin(this.currUser.uid) && this.study.state.canChangePermission;

    return (
      <>
        <Dimmer.Dimmable dimmed={this.isProcessing}>
          <Dimmer active={this.isProcessing} inverted>
            <Loader size="big" />
          </Dimmer>
          <Table striped className="mt0">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell width={2}>Permission Level</Table.HeaderCell>
                <Table.HeaderCell>
                  Users
                  {isEditable && !this.editModeOn && (
                    <Icon name="pencil" className="ml1 cursor-pointer" color="grey" onClick={this.enableEditMode} />
                  )}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {this.study.userTypes.map(userType => {
                const uids = studyPermissions[`${userType}Users`];
                const userIdentifiers = _.map(uids, uid => ({ uid }));
                const users = this.usersStore.asUserObjects(userIdentifiers);
                return (
                  <Table.Row key={userType}>
                    <Table.Cell style={{ textTransform: 'capitalize' }}>{userType}</Table.Cell>
                    <Table.Cell>
                      {this.editModeOn ? this.renderUsersDropdown(userType) : <UserLabels users={users} />}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>

          {this.editModeOn && (
            <>
              <Button
                floated="right"
                disabled={this.isProcessing}
                onClick={this.submitUpdate}
                size="mini"
                color="blue"
                icon
              >
                Submit
              </Button>

              <Button floated="right" disabled={this.isProcessing} onClick={this.resetForm} size="mini">
                Cancel
              </Button>
            </>
          )}
        </Dimmer.Dimmable>
      </>
    );
  }

  renderUsersDropdown(userType) {
    const dropdownOnChange = action((_event, data) => {
      this.selectedUserIds[userType] = data.value;
    });

    return (
      <Dropdown
        selection
        fluid
        multiple
        search
        options={this.usersStore.asDropDownOptions()}
        value={this.selectedUserIds[userType]}
        placeholder="Select users"
        onChange={dropdownOnChange}
      />
    );
  }
}

decorate(StudyPermissionsTable, {
  editModeOn: observable,
  isProcessing: observable,
  selectedUserIds: observable,

  enableEditMode: action,
  resetForm: action,
  submitUpdate: action,
});
export default inject('userStore', 'usersStore')(observer(StudyPermissionsTable));
