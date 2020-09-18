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
import { Button, Container, Header, Icon, Label } from 'semantic-ui-react';
import { withRouter } from 'react-router-dom';
import { inject, observer } from 'mobx-react';
import ReactTable from 'react-table';

import { isStoreError, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import DocumentationClient from '@aws-ee/base-ui/dist/parts/documentation-client/DocumentationClient';

class IndexesList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  getIndexesStore() {
    const store = this.props.indexesStore;
    store.load();
    return store;
  }

  getIndexes() {
    const store = this.getIndexesStore();
    return store.list;
  }

  renderMain() {
    const indexesData = this.getIndexes();
    const pageSize = indexesData.length;
    const pagination = indexesData.length > pageSize;
    return (
      <div>
        <ReactTable
          data={indexesData}
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
              Header: 'Index Name',
              accessor: 'id',
            },
            {
              Header: 'AWS Account',
              id: 'awsAccountId',
              accessor: row => this.props.awsAccountsStore.getNameForAccountId(row.awsAccountId),
            },
            {
              Header: 'Description',
              accessor: 'description',
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

  handleAddIndex = () => {
    this.goto('/indexes/add');
  };

  renderHeader() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="briefcase" className="align-top" />
          <Header.Content className="left-align">
            Indexes
            {this.renderTotal()}
          </Header.Content>
        </Header>
        <Button color="blue" size="medium" basic onClick={this.handleAddIndex}>
          Add Index
        </Button>
      </div>
    );
  }

  renderTotal() {
    return <Label circular>{this.getIndexes().length}</Label>;
  }

  render() {
    const store = this.getIndexesStore();
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
        <DocumentationClient urlSuffix="user_guide/sidebar/admin/accounts/indexes/introduction" />
        {this.renderHeader()}
        {content}
      </Container>
    );
  }
}

export default inject('awsAccountsStore', 'indexesStore')(withRouter(observer(IndexesList)));
