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
import { decorate, action, runInAction, observable } from 'mobx';
import { withRouter } from 'react-router-dom';
import { Header, Icon, Segment, Button } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import {
  isStoreLoading,
  isStoreReady,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
} from '@aws-ee/base-ui/dist/models/BaseStore';

import WorkflowCommonDraftCard from '../../workflow-common/drafts/WorkflowCommonDraftCard';
import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';
import CreateDraftWizard from './CreateWorkflowTemplateDraft';
import WorkflowTemplateCardTabs from '../WorkflowTemplateCardTabs';

// expected props
// - workflowTemplateDraftsStore (via injection)
// - location (from react router)
class WorkflowTemplateDraftsList extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.showCreateDraftWizard = false;
    });
  }

  componentDidMount() {
    const store = this.getStore();
    swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getStore();
    store.stopHeartbeat();
  }

  getStore() {
    return this.props.workflowTemplateDraftsStore;
  }

  handleCreateDraftClick() {
    this.showCreateDraftWizard = true;
  }

  handleCreateDraftCancel() {
    this.showCreateDraftWizard = false;
  }

  handleEditDraft = async draft => {
    const goto = gotoFn(this);
    goto(`/workflow-templates/drafts/edit/${encodeURIComponent(draft.id)}`);
  };

  render() {
    const store = this.getStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store) && isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreReady(store) && isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <div className="mb4">
        {this.renderTitle()}
        {this.renderWizard()}
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
          <Icon name="edit outline" />
          No workflow template drafts
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    const disabled = this.showCreateDraftWizard;
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="edit outline" className="align-top" />
          <Header.Content className="left-align">Workflow Template Drafts</Header.Content>
        </Header>
        <div>
          <Button basic color="blue" disabled={disabled} onClick={() => this.handleCreateDraftClick()}>
            Create Draft
          </Button>
        </div>
      </div>
    );
  }

  renderWizard() {
    const show = this.showCreateDraftWizard;
    if (!show) return null;
    return <CreateDraftWizard onCancel={() => this.handleCreateDraftCancel()} />;
  }

  renderMain() {
    const store = this.getStore();
    const list = store.list;

    return (
      <div>
        {_.map(list, draft => (
          <Segment className="mb2" clearing key={draft.id}>
            <WorkflowCommonDraftCard
              draft={draft}
              draftsStore={store}
              onEdit={this.handleEditDraft}
              className="pt0 pl2 pr2 pb2"
            >
              {({ uiState, version }) => <WorkflowTemplateCardTabs template={version} uiState={uiState} />}
            </WorkflowCommonDraftCard>
          </Segment>
        ))}
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowTemplateDraftsList, {
  handleCreateDraftClick: action,
  handleCreateDraftCancel: action,
  handleEditDraft: action,
  showCreateDraftWizard: observable,
});

export default inject('workflowTemplateDraftsStore')(withRouter(observer(WorkflowTemplateDraftsList)));
