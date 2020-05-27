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
import { decorate, action, observable, runInAction } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Container, Breadcrumb, Label, Segment } from 'semantic-ui-react';
import c from 'classnames';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { isStoreReady, isStoreEmpty, isStoreNotEmpty } from '@aws-ee/base-ui/dist/models/BaseStore';
import Stores from '@aws-ee/base-ui/dist/models/Stores';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import ProgressPlaceHolder from '../../../workflow-common/ProgressPlaceholder';
import { getWorkflowTemplateDraftEditor } from '../../../../models/workflow-templates/drafts/edit/WorkflowTemplateDraftEditor';
import WorkflowTemplateDraftMetaEditor from './WorkflowTemplateDraftMetaEditor';
import WorkflowCommonDraftStepsEditor from '../../../workflow-common/drafts/edit/WorkflowCommonDraftStepsEditor';
import WorkflowTemplateStepEditor from './WorkflowTemplateStepEditor';
import WorkflowTemplateDraftPublisher from './WorkflowTemplateDraftPublisher';

// expected props
// - workflowTemplateDraftsStore (via injection)
// - stepTemplatesStore (via injection)
// - draftId (via react router params)
// - className (via props)
// - location (from react router)
class WorkflowTemplateDraftEditor extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.stores = new Stores([this.getStore(), this.props.stepTemplatesStore]);
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    this.stores.load();
  }

  getStore() {
    return this.props.workflowTemplateDraftsStore;
  }

  getStores() {
    return this.stores;
  }

  getDraftEditor() {
    return getWorkflowTemplateDraftEditor(this.getDraft().id);
  }

  getDraftId() {
    return decodeURIComponent((this.props.match.params || {}).draftId);
  }

  getDraft() {
    const store = this.getStore();
    if (!isStoreReady(store)) return {};
    const draftId = this.getDraftId();

    if (_.isNil(draftId)) return {};
    return store.getDraft(draftId) || {};
  }

  getTemplateVersion() {
    const draft = this.getDraft();
    return draft.template || {};
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  hasDraft() {
    const store = this.getStore();
    const draft = this.getDraft();
    return store.hasDraft(draft.id);
  }

  handleCancel = () => {
    const editor = this.getDraftEditor();
    editor.cancel();
    const goto = gotoFn(this);
    goto('/workflow-templates/published');
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
      content = (
        <ErrorBox error="The workflow template draft does not exist or is no longer available" className="p0" />
      );
    } else if (stores.ready && isStoreNotEmpty(store)) {
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
    const draftId = this.getDraftId();
    const goto = gotoFn(this);
    return (
      <Breadcrumb className="block mb3">
        <Breadcrumb.Section link onClick={() => goto('/workflow-templates/published')}>
          Workflow Template Drafts
        </Breadcrumb.Section>
        <Breadcrumb.Divider icon="right angle" />
        <Breadcrumb.Section active>{draftId}</Breadcrumb.Section>
      </Breadcrumb>
    );
  }

  renderMain() {
    const hasDraft = this.hasDraft();
    const draftId = this.getDraftId();
    const className = this.props.className;
    const draft = this.getDraft();
    const templateVersion = this.getTemplateVersion();
    const { id, title } = templateVersion;
    const { createdAt, createdBy } = draft;
    const displayNameService = this.getUserDisplayNameService();
    const by = () => <span className="ml1">by {displayNameService.getDisplayName(createdBy)}</span>;

    if (!hasDraft) {
      return <ErrorBox error={`The workflow template draft "${draftId}" is not available`} className="p0" />;
    }

    return (
      <div className={c(className)}>
        <div className="flex mb2">
          <Header as="h3" color="grey" className="mt0 flex-auto ellipsis">
            <Label color="teal" className="ml0 mr1">
              Draft
            </Label>
            {title}
            <Header.Subheader className="fs-9 color-grey mt1">
              <div>
                <span className="ellipsis breakout">{id}</span>
              </div>
              <div>
                created <TimeAgo date={createdAt} /> {by()}
              </div>
            </Header.Subheader>
          </Header>
        </div>
        <Segment clearing className="p3">
          {this.renderContent()}
        </Segment>
      </div>
    );
  }

  renderContent() {
    const editor = this.getDraftEditor();
    const currentPage = editor.currentPage;

    if (currentPage === 0) return this.renderMetaContent(editor);
    if (currentPage === 1) return this.renderStepsContent(editor);
    if (currentPage === 2) return this.renderPublishContent(editor);
    return '';
  }

  renderMetaContent(editor) {
    return <WorkflowTemplateDraftMetaEditor editor={editor} onCancel={this.handleCancel} />;
  }

  renderStepsContent(editor) {
    return (
      <WorkflowCommonDraftStepsEditor
        editor={editor}
        stepEditor={WorkflowTemplateStepEditor}
        onCancel={this.handleCancel}
      />
    );
  }

  renderPublishContent(editor) {
    return <WorkflowTemplateDraftPublisher editor={editor} onCancel={this.handleCancel} />;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowTemplateDraftEditor, {
  handleCancel: action,
  stores: observable,
});

export default inject(
  'userDisplayName',
  'workflowTemplateDraftsStore',
  'stepTemplatesStore',
)(withRouter(observer(WorkflowTemplateDraftEditor)));
