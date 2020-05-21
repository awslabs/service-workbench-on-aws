import _ from 'lodash';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate, action, computed } from 'mobx';
import { Icon, Divider, Button, Segment, Header } from 'semantic-ui-react';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';

import PropsOverrideTable from '../../PropertyOverrideTable';

// expected props
// - stepEditor - a WorkflowTemplateStepEditor model instance (via props)
// - onSave - called when the props are saved (via props)
// - className (via props)
class WorkflowTemplateStepPropsOverrideEditor extends React.Component {
  getStepEditor() {
    return this.props.stepEditor;
  }

  getStep() {
    return this.getStepEditor().step;
  }

  getPropsOverrideForm() {
    return this.getStepEditor().propsOverrideForm;
  }

  get editing() {
    return this.getStepEditor().propsOverrideEdit;
  }

  handleEditOn = event => {
    event.preventDefault();
    event.stopPropagation();

    const stepEditorModel = this.getStepEditor();
    stepEditorModel.setPropsOverrideEdit(true);
  };

  handleEditOff = () => {
    const stepEditorModel = this.getStepEditor();
    stepEditorModel.setPropsOverrideEdit(false);
  };

  handleSave = async form => {
    const onSave = this.props.onSave || _.noop;
    const stepEditorModel = this.getStepEditor();
    const values = form.values();
    const allowed = _.filter(_.keys(values), key => values[key] === true);

    stepEditorModel.applyPropsOverrides(allowed);

    await onSave();
    stepEditorModel.setPropsOverrideEdit(false);
  };

  render() {
    const editing = this.editing;
    const canEdit = !editing;

    return (
      <div className={this.props.className}>
        {!editing && (
          <div className="flex">
            <div className="flex-auto">
              <Icon name="file alternate outline" className="mr1 color-grey" />
              <b>Properties Override</b>
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
    const rows = step.propertyOverrideSummaryRows || [];
    const hasRows = rows.length > 0;

    return (
      <>
        {hasRows && (
          <Segment padded>
            <PropsOverrideTable rows={rows} />
          </Segment>
        )}
        {!hasRows && <div>No properties are available to override</div>}
      </>
    );
  }

  renderEditingContent() {
    const form = this.getPropsOverrideForm();
    const step = this.getStep();
    const rows = step.propertyOverrideSummaryRows || [];
    const fields = _.map(rows, item => form.$(item.name));

    return (
      <>
        <Header textAlign="center" as="h2" color="grey" className="mt1 mb3">
          Change Properties Override
        </Header>
        <Form form={form} dimmer={false} onCancel={this.handleEditOff} onSuccess={this.handleSave}>
          {({ processing, _onSubmit, onCancel }) => (
            <div className="mt3">
              <Segment padded>
                <PropsOverrideTable rows={fields} editable processing={processing} />
              </Segment>
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
            </div>
          )}
        </Form>
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowTemplateStepPropsOverrideEditor, {
  editing: computed,
  handleEditOn: action,
  handleEditOff: action,
  handleSave: action,
});

export default inject()(observer(WorkflowTemplateStepPropsOverrideEditor));
