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
import { Button, Container, Header, Icon, Checkbox, Label, Dimmer, Loader, Segment, Radio } from 'semantic-ui-react';
import { withRouter } from 'react-router-dom';
import { decorate, action, observable, runInAction } from 'mobx';
import { getSnapshot } from 'mobx-state-tree';
import { inject, observer } from 'mobx-react';
import ReactTable from 'react-table';

import { isStoreError, isStoreLoading, isStoreReady } from '../../models/BaseStore';
import ErrorBox from '../helpers/ErrorBox';
import { createLink } from '../../helpers/routing';
import { displayError } from '../../helpers/notification';
import BasicProgressPlaceholder from '../helpers/BasicProgressPlaceholder';
import { swallowError } from '../../helpers/utils';

class UsersList extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      // An object that keeps track of which user is being edited
      // Each key in the object below has key as user's unique id (<ns>/<username>)
      // and value as flag indicating whether to show the editor for the user
      this.mapOfUsersBeingEdited = {};
      this.formProcessing = false;
    });
  }

  getStore() {
    return this.props.usersStore;
  }

  componentDidMount() {
    const store = this.getStore();
    swallowError(store.load());
  }

  handleEditorOn = user =>
    action(event => {
      event.preventDefault();
      event.stopPropagation();

      // Get the underlying plain JavaScript object from the "user"
      // MobX State Tree object using "getSnapshot" function
      this.mapOfUsersBeingEdited[user.id] = _.assign({ id: user.id }, getSnapshot(user));
      // The this.mapOfUsersBeingEdited is observable, to make sure the render is triggered update the this.mapOfUsersBeingEdited
      // reference by reassigning a new reference to this.mapOfUsersBeingEdited
      this.mapOfUsersBeingEdited = _.clone(this.mapOfUsersBeingEdited);
    });

  goto(pathname) {
    const { location, history } = this.props;
    const link = createLink({ location, pathname });
    history.push(link);
  }

  renderNoAdmins() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="users" />
          Brand new data lake
          <Header.Subheader className="mt2">
            No admin users in the Data Lake. Please add users in the Data Lake or Configure Authentication Provider then
            login as a regular non-root User.
          </Header.Subheader>
        </Header>
        <Segment.Inline>
          <Button color="blue" onClick={this.handleAddUser}>
            Add Users
          </Button>
          <Button color="teal" onClick={this.handleAddAuthenticationProvider}>
            Configure Auth Provider
          </Button>
        </Segment.Inline>
      </Segment>
    );
  }

  renderHeader() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="users" className="align-top" />
          <Header.Content className="left-align">
            Users
            {this.renderTotal()}
          </Header.Content>
        </Header>
        <Button color="blue" size="medium" basic onClick={this.handleAddUser}>
          Add User
        </Button>
      </div>
    );
  }

  renderTotal() {
    const store = this.getStore();
    if (isStoreError(store) || isStoreLoading(store)) return null;
    const usersList = store.list;
    const count = usersList.length;

    return <Label circular>{count}</Label>;
  }

  renderMain() {
    return this.renderUsers();
  }

  renderUsers() {
    // Read "this.mapOfUsersBeingEdited" in the "render" method here
    // The usersBeingEditedMap is then used in the ReactTable
    // If we directly use this.mapOfUsersBeingEdited in the ReactTable's cell method, MobX does not
    // realize that it is being used in the outer component's "render" method's scope
    // Due to this, MobX does not re-render the component when observable state changes.
    // To make this work correctly, we need to access "this.mapOfUsersBeingEdited" out side of ReactTable once
    const usersBeingEditedMap = this.mapOfUsersBeingEdited;

    const store = this.getStore();
    const usersList = store.list;
    // const nonRootUsers = store.list;
    const pageSize = Math.min(usersList.length, 50);
    const showPagination = usersList.length > pageSize;

    const displayEditableInput = attributeName => row => {
      const user = row.original;
      const userBeingEdited = usersBeingEditedMap[user.id];
      const handleChange = action(event => {
        event.preventDefault();
        userBeingEdited[attributeName] = event.target.value;
      });
      return userBeingEdited ? (
        <div className="ui focus input">
          <input type="text" defaultValue={row.value} onChange={handleChange} />
        </div>
      ) : (
        user[attributeName]
      );
    };

    const handleCheckboxChange = (userBeingEdited, attributeName) =>
      action((event, { checked }) => {
        userBeingEdited[attributeName] = checked;
        // update this.mapOfUsersBeingEdited reference to force re-render
        this.mapOfUsersBeingEdited = _.clone(this.mapOfUsersBeingEdited);
        event.stopPropagation();
      });
    const handleRadioChange = (userBeingEdited, attributeName) =>
      action((event, { value }) => {
        userBeingEdited[attributeName] = value;
        // update this.mapOfUsersBeingEdited reference to force re-render
        this.mapOfUsersBeingEdited = _.clone(this.mapOfUsersBeingEdited);
        event.stopPropagation();
      });

    const booleanColumnValueFilter = (trueString = 'yes', falseString = 'no') => (filter, row) => {
      const columnValueBoolean = row[filter.id];
      const columnValueStr = columnValueBoolean ? trueString : falseString;
      const filterValue = filter.value.toLowerCase();
      // Allow filtering by typing "yes/no" or "true/false"
      return (
        columnValueStr.indexOf(filterValue) === 0 ||
        String(columnValueBoolean)
          .toLowerCase()
          .indexOf(filterValue) === 0
      );
    };

    const processing = this.formProcessing;

    return (
      // TODO: add api token stats and active flag here in the table
      <Segment basic className="p0">
        <Dimmer active={processing} inverted>
          <Loader inverted>Updating</Loader>
        </Dimmer>
        <ReactTable
          data={usersList}
          defaultSorted={[{ id: 'lastName', desc: true }]}
          showPagination={showPagination}
          defaultPageSize={pageSize}
          className="-striped -highlight"
          filterable
          defaultFilterMethod={(filter, row) => {
            const columnValue = String(row[filter.id]).toLowerCase();
            const filterValue = filter.value.toLowerCase();
            return columnValue.indexOf(filterValue) >= 0;
          }}
          columns={[
            {
              Header: 'User Name',
              accessor: 'username',
            },
            {
              Header: 'Email',
              accessor: 'email',
              Cell: displayEditableInput('email'),
            },
            {
              Header: 'First Name',
              accessor: 'firstName',
              Cell: displayEditableInput('firstName'),
            },
            {
              Header: 'Last Name',
              accessor: 'lastName',
              Cell: displayEditableInput('lastName'),
            },
            {
              Header: 'Admin',
              accessor: 'isAdmin',
              filterMethod: booleanColumnValueFilter(),
              Cell: row => {
                const user = row.original;
                const userBeingEdited = usersBeingEditedMap[user.id];
                return userBeingEdited ? (
                  <span>
                    <Checkbox
                      checked={userBeingEdited.isAdmin}
                      label={userBeingEdited.isAdmin ? 'Yes' : 'No'}
                      onChange={handleCheckboxChange(userBeingEdited, 'isAdmin')}
                    />
                  </span>
                ) : user.isAdmin ? (
                  <span>
                    <i className="check circle outline icon green" />
                    Yes
                  </span>
                ) : (
                  <span>No</span>
                );
              },
            },
            {
              Header: 'Status',
              accessor: 'isActive',
              filterMethod: booleanColumnValueFilter('active', 'inactive'),
              minWidth: 125,
              Cell: row => {
                const user = row.original;
                const userBeingEdited = usersBeingEditedMap[user.id];
                const isActive = userBeingEdited ? userBeingEdited.status.toLowerCase() === 'active' : row.value;
                return userBeingEdited ? (
                  <span>
                    <Radio
                      name={`status-${user.id}`}
                      checked={isActive}
                      value="active"
                      label="Active"
                      onChange={handleRadioChange(userBeingEdited, 'status')}
                    />
                    <Radio
                      className="ml1"
                      name={`status-${user.id}`}
                      checked={!isActive}
                      value="inactive"
                      label="Inactive"
                      onChange={handleRadioChange(userBeingEdited, 'status')}
                    />
                  </span>
                ) : user.isActive ? (
                  <span>
                    <Label color="green">
                      <i className="check circle outline icon" />
                      Active
                    </Label>
                  </span>
                ) : (
                  <span>
                    <Label color="red">Inactive</Label>
                  </span>
                );
              },
            },
            {
              Header: '',
              filterable: false,
              Cell: cell => {
                const user = cell.original;
                const userBeingEdited = usersBeingEditedMap[user.id];
                return userBeingEdited ? (
                  <span>
                    <Icon
                      name="checkmark"
                      className="ml1 cursor-pointer"
                      color="green"
                      onClick={this.handleSave(userBeingEdited)}
                    />
                    <Icon
                      name="close"
                      className="ml1 cursor-pointer"
                      color="red"
                      onClick={this.handleCancel(userBeingEdited)}
                    />
                  </span>
                ) : (
                  <Icon name="pencil" className="ml1 cursor-pointer" color="blue" onClick={this.handleEditorOn(user)} />
                );
              },
            },
          ]}
        />
      </Segment>
    );
  }

  render() {
    const store = this.getStore();
    let content;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder segmentCount={3} />;
    } else if (isStoreReady(store) && !store.hasAdmins) {
      content = this.renderNoAdmins();
    } else if (isStoreReady(store) && store.hasAdmins) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3 animated fadeIn">
        {this.renderHeader()}
        {content}
      </Container>
    );
  }

  handleSave = user =>
    action(async event => {
      event.preventDefault();
      event.stopPropagation();

      this.formProcessing = true;

      try {
        await this.getStore().updateUser(user);
        runInAction(() => {
          this.mapOfUsersBeingEdited[user.id] = undefined;
          // // The this.mapOfUsersBeingEdited is observable, to make sure the render is triggered update the this.mapOfUsersBeingEdited
          // // reference by reassigning a new reference to this.mapOfUsersBeingEdited
          // this.mapOfUsersBeingEdited = _.assign({}, this.mapOfUsersBeingEdited);
          // this.mapOfUsersBeingEdited = {
          //   [user.id]: undefined,
          // };
          this.formProcessing = false;
        });
      } catch (err) {
        runInAction(() => {
          this.formProcessing = false;
        });
        displayError(err);
      }
    });

  handleCancel = user =>
    action(event => {
      event.preventDefault();
      event.stopPropagation();
      this.mapOfUsersBeingEdited[user.id] = undefined;
      // // The this.mapOfUsersBeingEdited is observable, to make sure the render is triggered update the this.mapOfUsersBeingEdited
      // // reference by reassigning a new reference to this.mapOfUsersBeingEdited
      this.mapOfUsersBeingEdited = _.clone(this.mapOfUsersBeingEdited);
      // this.mapOfUsersBeingEdited = {
      //   [user.id]: undefined,
      // };
    });

  handleAddUser = () => {
    this.goto('/users/add');
  };

  handleAddAuthenticationProvider = () => {
    this.goto('/authentication-providers');
  };
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(UsersList, {
  mapOfUsersBeingEdited: observable,
  formProcessing: observable,
});

export default inject('userStore', 'usersStore')(withRouter(observer(UsersList)));
