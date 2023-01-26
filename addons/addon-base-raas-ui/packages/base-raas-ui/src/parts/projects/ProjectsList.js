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
import { Button, Container, Header, Icon, Label, Popup } from 'semantic-ui-react';
import { withRouter } from 'react-router-dom';
import { runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import ReactTable from 'react-table';
import _ from 'lodash';

import { isStoreError, isStoreLoading } from '@amzn/base-ui/dist/models/BaseStore';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';
import { createLink } from '@amzn/base-ui/dist/helpers/routing';
import BasicProgressPlaceholder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import Stores from '@amzn/base-ui/dist/models/Stores';

import ProjectConfigure from './ProjectConfigure';

class ProjectsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    runInAction(() => {
      this.stores = new Stores([this.props.projectsStore]);
    });
  }

  getProjectsStore() {
    const store = this.props.projectsStore;
    store.load();
    return store;
  }

  getProjects() {
    const store = this.getProjectsStore();
    return store.list;
  }

  renderMain() {
    const projectsData = this.getProjects();
    const pageSize = projectsData.length;
    const pagination = projectsData.length > pageSize;
    return (
      <div data-testid="projects-table">
        <ReactTable
          data={projectsData}
          showPagination={pagination}
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
              Header: 'Project Name',
              accessor: 'id',
            },
            {
              Header: 'Index Id',
              accessor: 'indexId',
            },
            {
              Header: 'Description',
              accessor: 'description',
            },
            {
              Header: 'Project Admins',
              accessor: 'projectAdmins',
              style: { whiteSpace: 'unset' },
              Cell: observer(row => {
                const project = row.original;
                const projectAdminUsers = project.projectAdminUsers;
                return _.map(projectAdminUsers, u => u.username).join(', ') || '<<none>>';
              }),
            },
            {
              Header: '',
              accessor: 'viewDetail',
              filterable: false,
              Cell: observer(cell => {
                const project = { ...cell.original };
                return (
                  <div style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <span>
                      <Popup
                        content="View Project Detail"
                        trigger={
                          <ProjectConfigure
                            project={project}
                            userStore={this.props.userStore}
                            usersStore={this.props.usersStore}
                            projectsStore={this.props.projectsStore}
                            awsAccountsStore={this.props.awsAccountsStore}
                          />
                        }
                      />
                    </span>
                  </div>
                );
              }),
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

  handleAddProject = () => {
    this.goto('/projects/add');
  };

  renderHeader() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="briefcase" className="align-top" />
          <Header.Content className="left-align">
            Projects
            {this.renderTotal()}
          </Header.Content>
        </Header>
        <Button color="blue" size="medium" basic onClick={this.handleAddProject}>
          Add Project
        </Button>
      </div>
    );
  }

  renderTotal() {
    return <Label circular>{this.getProjects().length}</Label>;
  }

  render() {
    const store = this.getProjectsStore();
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

export default inject(
  'awsAccountsStore',
  'projectsStore',
  'userStore',
  'usersStore',
)(withRouter(observer(ProjectsList)));
