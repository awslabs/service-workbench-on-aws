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
import { observer, inject } from 'mobx-react';
import { decorate } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Segment, Icon, Table } from 'semantic-ui-react';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreReady, isStoreLoading, isStoreEmpty } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';

// expected props
// - workflowVersion (via props)
// - workflowsStore (via injection)
// - userDisplayName (via injection)
// - location (from react router)
class WorkflowAssignmentsList extends React.Component {
  componentDidMount() {
    const store = this.getAssignmentsStore();
    swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getAssignmentsStore();
    store.stopHeartbeat();
  }

  getWorkflowVersion() {
    return this.props.workflowVersion;
  }

  getWorkflowStore() {
    const version = this.getWorkflowVersion();
    return this.props.workflowsStore.getWorkflowStore(version.id);
  }

  getAssignmentsStore() {
    const workflowStore = this.getWorkflowStore();
    return workflowStore.getAssignmentsStore();
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  render() {
    const store = this.getAssignmentsStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store) && isStoreEmpty(store)) {
      content = this.renderEmptyAssignments();
    } else if (isStoreReady(store) && !isStoreEmpty(store)) {
      content = this.renderMain();
    } else {
      // We get here if the store is in the initial state
      content = null;
    }

    return <>{content}</>;
  }

  renderMain() {
    const store = this.getAssignmentsStore();
    const assignments = store.list;

    return <Segment padded>{this.renderAssignmentsTable(assignments)}</Segment>;
  }

  renderAssignmentsTable(assignments) {
    return (
      <Table basic="very" className="animated">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={1}>Id</Table.HeaderCell>
            <Table.HeaderCell width={4}>Trigger</Table.HeaderCell>
            <Table.HeaderCell width={8}>Configuration</Table.HeaderCell>
            <Table.HeaderCell width={3}>Updated</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>{_.map(assignments, assignment => this.renderAssignmentRow(assignment))}</Table.Body>
      </Table>
    );
  }

  renderAssignmentRow(assignment) {
    const { id, updatedAt, updatedBy, triggerType, triggerTypeData: config } = assignment;
    const displayNameService = this.getUserDisplayNameService();
    const isSystem = displayNameService.isSystem(updatedBy);
    const by = () => (isSystem ? '' : <span>by {displayNameService.getDisplayName(updatedBy)}</span>);

    return (
      <Table.Row key={id}>
        <Table.Cell>{id}</Table.Cell>
        <Table.Cell>{triggerType}</Table.Cell>
        <Table.Cell>{config}</Table.Cell>
        <Table.Cell>
          <TimeAgo date={updatedAt} />
          <div>{by()}&nbsp;</div>
        </Table.Cell>
      </Table.Row>
    );
  }

  renderEmptyAssignments() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="chain" />
          No assignments
          <Header.Subheader>
            Assignments allow you to configure the workflow to be triggered based on different criteria, try it out!
          </Header.Subheader>
        </Header>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowAssignmentsList, {});

export default inject('workflowsStore', 'userDisplayName')(withRouter(observer(WorkflowAssignmentsList)));
