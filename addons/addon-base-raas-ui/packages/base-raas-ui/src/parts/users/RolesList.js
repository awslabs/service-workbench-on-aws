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
import { Container, Header, Icon, Label } from 'semantic-ui-react';
import { withRouter } from 'react-router-dom';
import { decorate, observable, runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import ReactTable from 'react-table';

import { isStoreError, isStoreLoading } from '@amzn/base-ui/dist/models/BaseStore';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';
import { createLink } from '@amzn/base-ui/dist/helpers/routing';
import BasicProgressPlaceholder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

class RolesList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    runInAction(() => {
      // An object that keeps track of which user is being edited
      // Each key in the object below has key as user's unique id (<ns>/<username>)
      // and value as flag indicating whether to show the editor for the user
      this.mapOfUsersBeingEdited = {};
      this.formProcessing = false;
    });
  }

  getUserRolesStore() {
    const store = this.props.userRolesStore;
    return store;
  }

  getUserRoles() {
    const store = this.getUserRolesStore();
    return store.list;
  }

  renderMain() {
    const userRolesData = this.getUserRoles();
    const pageSize = userRolesData.length;
    const showPagination = userRolesData.length > pageSize;
    return (
      <div>
        <ReactTable
          data={userRolesData}
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
              Header: 'User Role Name',
              accessor: 'id',
            },
            {
              Header: 'Description',
              accessor: 'description',
            },
            {
              Header: 'User Type',
              accessor: 'userType',
            },
          ]}
        />
        <br />
      </div>
    );
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  handleAddUserRole = () => {
    this.goto('/user-roles/add');
  };

  renderHeader() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="id badge" className="align-top" />
          <Header.Content className="left-align">
            User Roles
            {this.renderTotal()}
          </Header.Content>
        </Header>
      </div>
    );
  }

  renderTotal() {
    return <Label circular>{this.getUserRoles().length}</Label>;
  }

  render() {
    const store = this.getUserRolesStore();
    let content;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder segmentCount={3} />;
    } else {
      content = this.renderMain();
    }
    return (
      <Container className="mt3 animated fadeIn">
        {this.renderHeader()}
        {content}
      </Container>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(RolesList, {
  mapOfUsersBeingEdited: observable,
  formProcessing: observable,
});

export default inject('userRolesStore')(withRouter(observer(RolesList)));
