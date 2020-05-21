import _ from 'lodash';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate, action, computed } from 'mobx';
import { Icon, Divider, Header, Button } from 'semantic-ui-react';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';

// expected props
// - stepEditor - a WorkflowStepEditor or a WorkflowTemplateStepEditor model instance (via props)
// - onSave - called when the desc/title are saved (via props)
// - className (via props)
class WorkflowCommonStepDescEditor extends React.Component {
  getStepEditor() {
    return this.props.stepEditor;
  }

  getStep() {
    return this.getStepEditor().step;
  }

  getDescForm() {
    return this.getStepEditor().descForm;
  }

  get editing() {
    return this.getStepEditor().descEdit;
  }

  handleEditOn = event => {
    event.preventDefault();
    event.stopPropagation();

    const stepEditorModel = this.getStepEditor();
    stepEditorModel.setDescEdit(true);
  };

  handleEditOff = () => {
    const stepEditorModel = this.getStepEditor();
    stepEditorModel.setDescEdit(false);
  };

  handleSave = async form => {
    const onSave = this.props.onSave || _.noop;
    const stepEditorModel = this.getStepEditor();
    const { stepTitle, stepDesc } = form.values();

    stepEditorModel.applyDescAndTitle(stepDesc, stepTitle);

    await onSave();
    stepEditorModel.setDescEdit(false);
  };

  render() {
    const editing = this.editing;
    const canEdit = !editing;

    return (
      <div className={this.props.className}>
        {!editing && (
          <div className="flex animated">
            <div className="flex-auto">
              <Icon name="file alternate outline" className="mr1 color-grey" />
              <b>Description</b>
            </div>
            {canEdit && (
              <div className="pl1 pr0" onClick={this.handleEditOn}>
                <Icon name="edit" color="grey" className="cursor-pointer" />
              </div>
            )}
          </div>
        )}
        <Divider className="mt1 mb2" />
        {editing && this.renderEditingContent()}
        {!editing && this.renderReadOnlyContent()}
      </div>
    );
  }

  renderReadOnlyContent() {
    const step = this.getStep();

    return <div className="animated" dangerouslySetInnerHTML={{ __html: step.descHtml }} />; // eslint-disable-line react/no-danger
  }

  renderEditingContent() {
    const form = this.getDescForm();
    const stepTitleField = form.$('stepTitle');
    const stepDescField = form.$('stepDesc');

    return (
      <>
        <Header textAlign="center" as="h2" color="grey" className="mt1 mb3">
          Change Title &amp; Description
        </Header>
        <Form form={form} dimmer={false} onCancel={this.handleEditOff} onSuccess={this.handleSave}>
          {({ processing, _onSubmit, onCancel }) => (
            <>
              <Input field={stepTitleField} disabled={processing} />
              <TextArea field={stepDescField} rows={6} disabled={processing} />
              <div className="mt3 clearfix">
                <Button
                  floated="right"
                  color="blue"
                  icon="save"
                  labelPosition="left"
                  disabled={processing}
                  className="ml2"
                  type="submit"
                  content="Save"
                />
                <Button floated="left" disabled={processing} onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Form>
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowCommonStepDescEditor, {
  editing: computed,
  handleEditOn: action,
  handleEditOff: action,
  handleSave: action,
});

export default inject()(observer(WorkflowCommonStepDescEditor));
