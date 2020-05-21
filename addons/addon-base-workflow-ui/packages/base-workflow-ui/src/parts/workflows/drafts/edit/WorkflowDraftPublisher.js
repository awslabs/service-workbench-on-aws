import _ from 'lodash';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate, action, runInAction, observable } from 'mobx';
import { withRouter } from 'react-router-dom';
import { Button, Header, Dimmer, Loader } from 'semantic-ui-react';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import getUIState from '../../../workflow-common/component-states/WorkflowCommonCardState';
import WorkflowTemplateCardTabs from '../../../workflow-templates/WorkflowTemplateCardTabs';

// expected props
// - editor (via prop) an instance of the WorkflowDraftEditor model
// - uiEventBus (via props)
// - onCancel (via props)
// - location (from react router)
class WorkflowDraftPublisher extends React.Component {
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
    const version = this.getVersion();
    return getUIState(`${version.id}-workflow-draft-publish-page`);
  }

  // Return WorkflowDraftEditor
  getEditor() {
    return this.props.editor;
  }

  // Returns WorkflowVersion
  getVersion() {
    return this.getEditor().version;
  }

  handleCancel = event => {
    event.preventDefault();
    event.stopPropagation();
    this.processing = false;
    const onCancel = this.props.onCancel || _.noop;
    onCancel();
  };

  handlePrevious = event => {
    event.preventDefault();
    event.stopPropagation();
    this.processing = false;
    this.getEditor().previousPage();
  };

  handlePublish = async event => {
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
      await eventBus.fireEvent('workflowPublished', publishResult.workflow);
      displaySuccess('The workflow draft is published successfully');
      goto('/workflows/published');
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
    const version = this.getVersion();
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
          {/* TODO add an elaborate error/validation error panel, showing errors at all levels including workflow level and step level */}
          <WorkflowTemplateCardTabs template={version} uiState={uiState} className="mb4 mt0" />
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
decorate(WorkflowDraftPublisher, {
  handleCancel: action,
  handlePublish: action,
  handlePrevious: action,
  processing: observable,
});

export default inject('uiEventBus')(withRouter(observer(WorkflowDraftPublisher)));
