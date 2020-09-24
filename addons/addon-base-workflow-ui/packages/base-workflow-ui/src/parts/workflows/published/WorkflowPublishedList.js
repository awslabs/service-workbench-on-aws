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
import { decorate, action, runInAction } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Icon, Segment, Message, Table } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { isStoreEmpty, isStoreNotEmpty } from '@aws-ee/base-ui/dist/models/BaseStore';
import Stores from '@aws-ee/base-ui/dist/models/Stores';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

// eslint-disable-next-line import/no-useless-path-segments
import whiteGradient from '../../../../src/images/white-gradient.png'; // We need this because we are getting the image from src and not dist
import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';

// expected props
// - workflowsStore (via injection)
// - userDisplayName (via injection)
// - location (from react router)
class WorkflowPublishedList extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([this.getStore()]);
    });
  }

  componentDidMount() {
    this.getStores().load({ forceLoad: true });
    const store = this.getStore();
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getStore();
    store.stopHeartbeat();
  }

  getStores() {
    return this.stores;
  }

  getStore() {
    return this.props.workflowsStore;
  }

  getUserDisplayName() {
    return this.props.userDisplayName;
  }

  handleWorkflowClick = event => {
    event.preventDefault();
    event.stopPropagation();

    // see https://reactjs.org/docs/events.html and https://github.com/facebook/react/issues/5733
    const workflowId = event.currentTarget.dataset.workflow;
    const version = event.currentTarget.dataset.version;
    const goto = gotoFn(this);

    goto(`/workflows/published/id/${workflowId}/v/${version}`);
  };

  render() {
    const stores = this.getStores();
    const store = this.getStore();
    let content = null;

    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0" />;
    } else if (stores.loading) {
      content = <ProgressPlaceHolder />;
    } else if (stores.ready && isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (stores.ready && isStoreNotEmpty(store)) {
      content = this.renderTable();
    } else {
      content = null;
    }

    return (
      <div className="mb4">
        {this.renderTitle()}
        {content}
      </div>
    );
  }

  renderEmpty() {
    const show = this.showCreateDraftWizard;
    if (show) return null;
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="fork" />
          No workflows
          <Header.Subheader>
            To create a workflow, start by creating a draft and then publish the draft.
          </Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="fork" className="align-top" />
          <Header.Content className="left-align">Workflows</Header.Content>
        </Header>
      </div>
    );
  }

  renderTable() {
    const store = this.getStore();
    const list = store.list;

    return (
      <Table selectable padded>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell singleLine>Workflow</Table.HeaderCell>
            <Table.HeaderCell>Updated</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>{_.map(list, workflow => this.renderWorkflowRow(workflow))}</Table.Body>
      </Table>
    );
  }

  renderWorkflowRow(workflow) {
    const latest = workflow.latest;
    if (!latest)
      return (
        <Table.Row>
          <Table.Cell colSpan="2">
            <Message warning>
              <p>Workflow &quot;{workflow.id}&quot; does not have any version!</p>
            </Message>
          </Table.Cell>
        </Table.Row>
      );

    const { id, v, title, updatedAt, updatedBy } = latest;
    const userDisplayName = this.getUserDisplayName();
    const isSystem = userDisplayName.isSystem({ uid: updatedBy });
    const by = () => (isSystem ? '' : <span>{userDisplayName.getDisplayName({ uid: updatedBy })}</span>);

    return (
      <Table.Row
        className="cursor-pointer"
        key={workflow.id}
        data-workflow={workflow.id}
        data-version={workflow.latest.v}
        onClick={this.handleWorkflowClick}
      >
        <Table.Cell>
          <Header as="h4" color="grey">
            {title}
            <Header.Subheader className="fs-9">
              <div>
                <span className="ellipsis breakout color-grey">
                  {id} v{v}
                </span>
              </div>
            </Header.Subheader>
          </Header>
        </Table.Cell>
        <Table.Cell collapsing>
          <div>{by()}</div>
          <TimeAgo date={updatedAt} />
        </Table.Cell>
      </Table.Row>
    );
  }

  renderDescription(latest) {
    /* eslint-disable react/no-danger */
    return (
      <>
        <div className="overflow-hidden height-60-px">
          <div dangerouslySetInnerHTML={{ __html: latest.descHtml }} />
        </div>
        <img src={whiteGradient} alt="" className="absolute height-50-px" style={{ bottom: '0', maxWidth: '100%' }} />
      </>
    );
    /* eslint-enable react/no-danger */
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowPublishedList, {
  handleWorkflowClick: action,
});

export default inject('workflowsStore', 'userDisplayName')(withRouter(observer(WorkflowPublishedList)));
