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
import { action, computed, decorate, observable, runInAction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Header, Card, Icon, Label, Segment, Radio } from 'semantic-ui-react';

import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';
import BasicProgressPlaceholder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { swallowError } from '@amzn/base-ui/dist/helpers/utils';
import {
  isStoreEmpty,
  isStoreError,
  isStoreLoading,
  isStoreNotEmpty,
  isStoreReady,
} from '@amzn/base-ui/dist/models/BaseStore';
import { envMgmtRoleName } from '../../helpers/settings';
import * as EnvTypeStatusEnum from '../../models/environment-types/EnvTypeStatusEnum';
import EnvTypeCard from './EnvTypeCard';

// expected props
// - envTypesStore (via injection)
class EnvTypesList extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.statusFilter = '*';
    });
  }

  componentDidMount() {
    swallowError(this.envTypesStore.load());
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }

  render() {
    const store = this.envTypesStore;
    let content;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0 mb3" />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder />;
    } else if (isStoreReady(store) && isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreReady(store) && isStoreNotEmpty(store)) {
      const list = this.envTypesList;
      if (_.isEmpty(list)) {
        // The store may not be empty (there may be env types) but if the user selected to show only approved or
        // not-approved versions then that list may be empty so checking for "isEmpty" here in addition to "isStoreEmpty"
        // check above
        content = this.renderEmpty();
      } else {
        content = this.renderMain();
      }
    } else {
      content = null;
    }

    return (
      <Container className="mt3 mb4">
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderTitle() {
    const renderCount = () => {
      const store = this.envTypesStore;
      const showCount = isStoreReady(store) && isStoreNotEmpty(store);
      return (
        showCount && (
          <Label circular size="medium">
            {this.envTypesList.length}
          </Label>
        )
      );
    };
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="computer" className="align-top" />
          <Header.Content className="left-align">
            Workspace Types
            {renderCount()}
          </Header.Content>
          <Header.Subheader className="mt2">
            AWS Service Catalog Product Versions imported as Environment Types
          </Header.Subheader>
        </Header>
        <div>
          <Radio
            label="Approved"
            name="statusFilter"
            checked={EnvTypeStatusEnum.isApproved(this.statusFilter)}
            value={EnvTypeStatusEnum.approved}
            onChange={this.handleStatusFilterChange}
            className="mr2"
          />
          <Radio
            label="Not Approved"
            name="statusFilter"
            checked={EnvTypeStatusEnum.isNotApproved(this.statusFilter)}
            value={EnvTypeStatusEnum.notApproved}
            onChange={this.handleStatusFilterChange}
            className="mr2"
          />
          <Radio
            label="All"
            name="statusFilter"
            checked={this.statusFilter === '*'}
            value="*"
            onChange={this.handleStatusFilterChange}
            className="mr2"
          />
        </div>
      </div>
    );
  }

  handleStatusFilterChange = (e, { value }) => {
    this.statusFilter = value;
  };

  renderEmpty() {
    const getEmptyMessage = () => {
      let msg;
      if (EnvTypeStatusEnum.isApproved(this.statusFilter)) {
        msg = <>No approved Environment Types found</>;
      } else if (EnvTypeStatusEnum.isNotApproved(this.statusFilter)) {
        msg = <>No Environments Types found that require approval</>;
      } else {
        msg = (
          <>
            No AWS Service Catalog Product Versions imported yet
            <Header.Subheader className="mt2">
              Start by importing an AWS Service Catalog Product Version as Environment Type. AWS Service Catalog
              Products that are part of AWS Service Catalog Portfolio shared with AWS IAM role{' '}
              <strong>{envMgmtRoleName}</strong> are eligible for importing.
            </Header.Subheader>
          </>
        );
      }
      return msg;
    };
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="computer" />
          {getEmptyMessage()}
        </Header>
      </Segment>
    );
  }

  renderMain() {
    const list = this.envTypesList;
    return (
      <Card.Group stackable itemsPerRow={3}>
        {_.map(list, envType => {
          return <EnvTypeCard key={envType.id} envType={envType} envTypesStore={this.envTypesStore} />;
        })}
      </Card.Group>
    );
  }

  get envTypesList() {
    let list = [];
    if (EnvTypeStatusEnum.isApproved(this.statusFilter)) {
      list = this.envTypesStore.listApproved;
    } else if (EnvTypeStatusEnum.isNotApproved(this.statusFilter)) {
      list = this.envTypesStore.listNotApproved;
    } else {
      list = this.envTypesStore.list;
    }
    return list;
  }
}

decorate(EnvTypesList, {
  envTypesList: computed,
  envTypesStore: computed,

  statusFilter: observable,

  handleStatusFilterChange: action,
});

export default inject('envTypesStore')(withRouter(observer(EnvTypesList)));
