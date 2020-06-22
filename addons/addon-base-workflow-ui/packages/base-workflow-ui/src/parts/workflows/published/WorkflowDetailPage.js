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
import { decorate, action } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Label, Breadcrumb, Container, Dropdown } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreReady, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';
import getUIState from '../../workflow-common/component-states/WorkflowCommonCardState';
import WorkflowDetailTabs from './WorkflowDetailTabs';

// expected props
// - workflowsStore (via injection)
// - userDisplayName (via injection)
// - location (from react router)
class WorkflowDetailPage extends React.Component {
  componentDidMount() {
    const store = this.getStore();
    swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getStore();
    store.stopHeartbeat();
  }

  getState() {
    return getUIState(`wf-${this.getWorkflowId()}`);
  }

  getStore() {
    const workflowId = this.getWorkflowId();
    return this.props.workflowsStore.getWorkflowStore(workflowId);
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  getWorkflowId() {
    return (this.props.match.params || {}).workflowId;
  }

  getVersionNumber() {
    return parseInt((this.props.match.params || {}).version, 10);
  }

  getWorkflow() {
    const store = this.getStore();
    if (!isStoreReady(store)) return {};
    return store.workflow;
  }

  getVersion() {
    const workflow = this.getWorkflow();
    const num = this.getVersionNumber();

    return workflow.getVersion(num);
  }

  handleVersionChange = ({ value = '' }) => {
    const goto = gotoFn(this);
    const workflowId = this.getWorkflowId();
    goto(`/workflows/published/id/${workflowId}/v/${value}`);
  };

  render() {
    const store = this.getStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3">
        {this.renderBreadcrumb()}
        {content}
      </Container>
    );
  }

  renderBreadcrumb() {
    const workflowId = this.getWorkflowId();
    const goto = gotoFn(this);

    return (
      <Breadcrumb className="block mb3">
        <Breadcrumb.Section link onClick={() => goto('/workflows/published')}>
          Workflows
        </Breadcrumb.Section>
        <Breadcrumb.Divider icon="right angle" />
        <Breadcrumb.Section active>{workflowId}</Breadcrumb.Section>
      </Breadcrumb>
    );
  }

  renderMain() {
    const version = this.getVersion();
    const { id, title, updatedAt, updatedBy, descHtml } = version;
    const displayNameService = this.getUserDisplayNameService();
    const isSystem = displayNameService.isSystem(updatedBy);
    const by = () => (isSystem ? '' : <span className="ml1">by {displayNameService.getDisplayName(updatedBy)}</span>);

    const uiState = this.getState();

    /* eslint-disable react/no-danger */
    return (
      <>
        <div className="flex mb2">
          <Header as="h3" color="grey" className="mt0 flex-auto ellipsis">
            <Label color="teal" className="ml0 mr1">
              Workflow
            </Label>
            {title}
            <Header.Subheader className="fs-9 color-grey mt1">
              <div>
                updated <TimeAgo date={updatedAt} /> {by()}
              </div>
            </Header.Subheader>
          </Header>
          <div className="ml1">
            <span className="ellipsis pr1 fs-9 breakout color-grey">{id}</span> {this.renderVersionDropdown()}
          </div>
        </div>
        <div className="mb3">
          <div dangerouslySetInnerHTML={{ __html: descHtml }} />
        </div>
        <WorkflowDetailTabs uiState={uiState} workflow={version} />
      </>
    );
    /* eslint-enable react/no-danger */
  }

  renderVersionDropdown() {
    const workflow = this.getWorkflow();
    const versions = workflow.versionNumbers;
    const currentVersion = this.getVersionNumber();
    const options = _.map(versions, version => ({ text: `v${version}`, value: version }));

    if (versions.length === 1) return <span className="bold color-grey pr2">v{currentVersion}</span>;

    return (
      <Dropdown
        className="color-grey"
        inline
        options={options}
        value={currentVersion}
        onChange={(_e, data) => this.handleVersionChange(data)}
      />
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowDetailPage, {
  handleVersionChange: action,
});

export default inject('workflowsStore', 'userDisplayName')(withRouter(observer(WorkflowDetailPage)));
