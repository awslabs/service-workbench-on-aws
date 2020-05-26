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
import { observer, inject, Observer } from 'mobx-react';
import { decorate, action, runInAction, observable } from 'mobx';
import { Button, Header, Dimmer, Loader, Message } from 'semantic-ui-react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import c from 'classnames';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';

import AddStepDropDown from '../../../workflow-step-templates/AddStepDropDown';

// expected props
// - editor (via prop) an instance of the WorkflowTemplateDraftEditor model or WorkflowDraftEditor model
// - stepEditor (vai props) an instance of the WorkflowTemplateStepEditor react component or WorkflowStepEditor reactComponent
class WorkflowCommonDraftStepsEditor extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.processing = false;
      this.clickedOnNext = false;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  getEditor() {
    return this.props.editor;
  }

  getStepEditorComponent() {
    return this.props.stepEditor;
  }

  getVersion() {
    return this.getEditor().version;
  }

  getSelectedSteps() {
    return this.getVersion().selectedSteps;
  }

  handleAddStep = step => {
    if (!step) return;
    this.getEditor().addStep(step);
  };

  handleCancel = event => {
    event.preventDefault();
    event.stopPropagation();
    this.clickedOnNext = false;
    this.processing = false;
    const onCancel = this.props.onCancel || _.noop;
    onCancel();
  };

  handleDelete = step => {
    const editor = this.getEditor();
    const version = this.getVersion();
    const id = step.id;

    version.removeStep(step);
    setTimeout(() => {
      editor.removeStepEditor(id);
    }, 150);
  };

  handleNext = async event => {
    this.clickedOnNext = true;
    return this.handleSave(event);
  };

  handlePrevious = event => {
    // we don't save the form in this case
    event.preventDefault();
    event.stopPropagation();
    this.clickedOnNext = false;
    this.getEditor().previousPage();
  };

  handleSave = async event => {
    event.preventDefault();
    event.stopPropagation();

    const editor = this.getEditor();
    const { draft } = editor;

    this.processing = true;

    try {
      await editor.update(draft);
      runInAction(() => {
        this.processing = false;
      });
      if (this.clickedOnNext) {
        this.getEditor().nextPage();
        return;
      }
      displaySuccess('Saved successfully');
    } catch (error) {
      runInAction(() => {
        this.processing = false;
        this.clickedOnNext = false;
      });
      displayError(error);
    }
  };

  handleStepSave = async () => {
    const editor = this.getEditor();
    const { draft } = editor;

    this.processing = true;

    try {
      await editor.update(draft);
      runInAction(() => {
        this.processing = false;
      });
      displaySuccess('Saved successfully');
    } catch (error) {
      runInAction(() => {
        this.processing = false;
      });
      displayError(error);
    }
  };

  onDragEnd = result => {
    const version = this.getVersion();
    if (!version.canRearrangeSteps) return;

    // see https://egghead.io/lessons/react-persist-list-reordering-with-react-beautiful-dnd-using-the-ondragend-callback
    const { draggableId, destination, source } = result;
    const isSource = source.droppableId === 'selected-steps';
    const isDestination = destination && destination.droppableId === 'selected-steps';
    const isStep = !!version.getStep(draggableId);

    if (!destination) {
      // we don't support removal of a step by dragging it out of its container
      return;
    }

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      // we don't need to do anything here
      return;
    }

    if (isSource && isDestination && isStep) {
      // we are dealing with reordering of the steps
      version.reinsertStep(source.index, destination.index);
    }
  };

  render() {
    const processing = this.processing;
    const editor = this.getEditor();
    const editing = editor.stepEditorsEditing;
    const hasPrevious = editor.hasPreviousPage;
    const version = this.getVersion();
    const canRearrange = version.canRearrangeSteps;

    return (
      <>
        <Dimmer.Dimmable dimmed={processing}>
          <Dimmer active={processing} inverted>
            <Loader inverted>Processing</Loader>
          </Dimmer>
          <Header as="h3" color="grey" className="mt0">
            Steps
          </Header>
          {!canRearrange && (
            <Message warning>
              <b className="mr1">Warning</b> The workflow template used by this workflow does <b>not</b> allow for steps
              to be deleted, added or rearranged
            </Message>
          )}
          {canRearrange && (
            <DragDropContext onDragEnd={this.onDragEnd}>
              <Droppable droppableId="selected-steps">
                {(provided, snapshot) => (
                  <Observer>
                    {() => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={c('mb3', snapshot.isDraggingOver ? 'bg-lightgreen' : '')}
                      >
                        {this.renderSelectedSteps()}
                        {provided.placeholder}
                      </div>
                    )}
                  </Observer>
                )}
              </Droppable>
            </DragDropContext>
          )}
          {!canRearrange && <div className="mb3">{this.renderSelectedSteps()}</div>}
          <AddStepDropDown className="mb3" onSelected={this.handleAddStep} disabled={!canRearrange} />
        </Dimmer.Dimmable>
        {!editing && (
          <div>
            <Button
              floated="right"
              color="teal"
              icon="right arrow"
              labelPosition="right"
              disabled={processing}
              className="ml2"
              content="Next"
              onClick={this.handleNext}
            />
            {hasPrevious && (
              <Button
                floated="right"
                icon="left arrow"
                labelPosition="left"
                disabled={processing}
                className="ml3"
                content="previous"
                onClick={this.handlePrevious}
              />
            )}
            <Button
              floated="right"
              color="blue"
              icon="save"
              labelPosition="left"
              disabled={processing}
              className="ml2"
              content="Save"
              onClick={this.handleSave}
            />
            <Button floated="left" disabled={processing} onClick={this.handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </>
    );
  }

  renderSelectedSteps() {
    const selectedSteps = this.getSelectedSteps();
    const size = selectedSteps.length;

    if (size === 0) {
      return null;
    }

    const version = this.getVersion();
    const canRearrange = version.canRearrangeSteps;
    const editor = this.getEditor();
    const getStepEditor = step => editor.getStepEditor(step);
    const StepEditorComponent = this.getStepEditorComponent();

    if (!canRearrange)
      return _.map(selectedSteps, step => (
        <div key={step.id} className="mb3">
          <Observer>
            {() => (
              <StepEditorComponent
                stepEditor={getStepEditor(step)}
                onDelete={this.handleDelete}
                onSave={this.handleStepSave}
                canMove={canRearrange}
                canDelete={canRearrange}
              />
            )}
          </Observer>
        </div>
      ));

    return _.map(selectedSteps, (step, index) => (
      <Draggable key={step.id} draggableId={step.id} index={index}>
        {(provided, _snapshot) => (
          <div {...provided.dragHandleProps} ref={provided.innerRef} {...provided.draggableProps} className="mb3">
            <StepEditorComponent
              stepEditor={getStepEditor(step)}
              onDelete={this.handleDelete}
              onSave={this.handleStepSave}
              canMove={canRearrange}
              canDelete={canRearrange}
            />
          </div>
        )}
      </Draggable>
    ));
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowCommonDraftStepsEditor, {
  onDragEnd: action,
  handleAddStep: action,
  handleCancel: action,
  handleDelete: action,
  handleSave: action,
  handleStepSave: action,
  handleNext: action,
  handlePrevious: action,
  clickedOnNext: observable,
  processing: observable,
});

export default inject()(observer(WorkflowCommonDraftStepsEditor));
