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
import { Button, Header, Dimmer, Loader } from 'semantic-ui-react';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import getUIState from '../../../workflow-common/component-states/WorkflowCommonCardState';
import WorkflowTemplateCardTabs from '../../WorkflowTemplateCardTabs';

// expected props
// - editor (via prop) an instance of the WorkflowTemplateDraftEditor model
// - uiEventBus (via props)
// - location (from react router)
class WorkflowTemplateDraftPublisher extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.processing = false;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  getUiEventBus() {
    return this.props.uiEventBus;
  }

  getState() {
    const template = this.getWorkflowTemplate();
    return getUIState(`${template.id}-draft-publish-page`);
  }

  // Return WorkflowTemplateDraftEditor
  getEditor() {
    return this.props.editor;
  }

  getWorkflowTemplate() {
    return this.getEditor().draft.template;
  }

  handleCancel = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.processing = false;
    const onCancel = this.props.onCancel || _.noop;
    onCancel();
  };

  handlePrevious = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.processing = false;
    this.getEditor().previousPage();
  };

  handlePublish = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const editor = this.getEditor();
    const { draft } = editor;
    const goto = gotoFn(this);

    this.processing = true;

    try {
      const publishResult = await editor.publish(draft);
      runInAction(() => {
        this.processing = false;
      });
      // TODO examine the publishResult and figure out if we have validation errors
      if (publishResult.hasErrors) {
        throw new Error('There were validation errors in your submission');
      }
      const eventBus = this.getUiEventBus();
      await eventBus.fireEvent('workflowTemplatePublished', publishResult.template);
      displaySuccess('The workflow template draft is published successfully');
      goto('/workflow-templates/published');
      return;
    } catch (error) {
      runInAction(() => {
        this.processing = false;
      });
      displayError(error);
    }
  };

  render() {
    const processing = this.processing;
    const template = this.getWorkflowTemplate();
    const uiState = this.getState();

    return (
      <>
        <Dimmer.Dimmable dimmed={processing}>
          <Dimmer active={processing} inverted>
            <Loader inverted>Processing</Loader>
          </Dimmer>
          <Header as="h3" color="grey" className="mt0 mb3">
            Review &amp; Publish
          </Header>
          {/* TODO add an elaborate error/validation error panel, showing errors at all levels including workflow template level and step level */}
          <WorkflowTemplateCardTabs template={template} uiState={uiState} className="mb4 mt0" />
        </Dimmer.Dimmable>
        <div>
          <Button
            floated="right"
            color="teal"
            disabled={processing}
            className="ml2"
            content="Publish"
            onClick={this.handlePublish}
          />
          <Button
            floated="right"
            icon="left arrow"
            labelPosition="left"
            disabled={processing}
            className="ml3"
            content="previous"
            onClick={this.handlePrevious}
          />
          <Button floated="left" disabled={processing} onClick={this.handleCancel}>
            Cancel
          </Button>
        </div>
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowTemplateDraftPublisher, {
  handleCancel: action,
  handlePublish: action,
  handlePrevious: action,
  processing: observable,
});

export default inject('uiEventBus')(withRouter(observer(WorkflowTemplateDraftPublisher)));
