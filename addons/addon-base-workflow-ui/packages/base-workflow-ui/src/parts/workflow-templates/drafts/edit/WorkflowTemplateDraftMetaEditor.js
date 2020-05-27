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
import { Button, Header, Divider, Icon, Segment } from 'semantic-ui-react';

import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';
import PropsOverrideTable from '../../PropertyOverrideTable';

// expected props
// - editor (via props) an instance of the WorkflowTemplateDraftEditor model
// - onCancel (via props)
class WorkflowTemplateDraftMetaEditor extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.clickedOnNext = false;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  // WorkflowTemplateDraftEditor
  getEditor() {
    return this.props.editor;
  }

  getWorkflowTemplate() {
    return this.getEditor().draft.template;
  }

  getMetaForm() {
    return this.getEditor().metaForm;
  }

  resetFlags() {
    // we use these flags to tell the difference between clicking on 'save' vs 'next' because
    // 'next' will result in saving the form
    this.clickedOnNext = false;
  }

  handleCancel = () => {
    this.resetFlags();
    const onCancel = this.props.onCancel || _.noop;
    onCancel();
  };

  handlePrevious = event => {
    // we don't save the form in this case
    this.resetFlags();
    event.preventDefault();
    event.stopPropagation();
    this.getEditor().previousPage();
  };

  handleOnSubmitNext(event, onSubmit) {
    event.preventDefault();
    event.stopPropagation();
    this.resetFlags();
    this.clickedOnNext = true;

    onSubmit(event); // this will eventually call handleFormSubmission()
  }

  handleFormSubmission = async form => {
    const editor = this.getEditor();
    const { templateTitle, templateDesc, instanceTtl, runSpecSize, runSpecTarget } = form.values();
    const { draft } = editor;
    const template = draft.template;
    const allowed = [];
    const toPropsOverride = (key, value) => {
      const item = key.replace(/^propsOverride_/, '');
      if (_.startsWith(key, 'propsOverride_') && !_.isEmpty(item) && value === true) allowed.push(item);
    };

    _.forEach(form.values(), (value, key) => toPropsOverride(key, value));

    template.setTitle(templateTitle);
    template.setDescription(templateDesc);
    template.setInstanceTtl(instanceTtl);
    template.setRunSpec({
      size: runSpecSize,
      target: runSpecTarget,
    });
    template.setPropsOverrideOption({ allowed });

    try {
      await editor.update(draft);
      if (this.clickedOnNext) {
        this.getEditor().nextPage();
        return;
      }
      displaySuccess('The workflow template draft is saved successfully');
    } catch (error) {
      runInAction(() => {
        this.resetFlags();
      });
      displayError(error);
    }
  };

  handleFormErrors = () => {
    window.scrollTo(0, 0);
  };

  render() {
    const editor = this.getEditor();
    const hasPrevious = editor.hasPreviousPage;
    const form = this.getMetaForm();
    const templateTitleField = form.$('templateTitle');
    const templateDescField = form.$('templateDesc');
    const instanceTtlField = form.$('instanceTtl');
    const runSpecSizeField = form.$('runSpecSize');
    const runSpecTargetField = form.$('runSpecTarget');
    const rows = this.getWorkflowTemplate().propertyOverrideSummaryRows || [];
    const fields = _.map(rows, item => form.$(`propsOverride_${item.name}`));

    return (
      <Form
        form={form}
        onCancel={this.handleCancel}
        onSuccess={this.handleFormSubmission}
        onError={this.handleFormErrors}
      >
        {({ processing, onSubmit, onCancel }) => (
          <>
            <Input field={templateTitleField} disabled={processing} />
            <TextArea field={templateDescField} rows={6} disabled={processing} />
            <Divider horizontal className="mb3">
              <Header as="h4" className="color-grey">
                <Icon name="list alternate outline" className="color-grey" />
                Properties
              </Header>
            </Divider>
            <Input field={instanceTtlField} disabled={processing} />
            <DropDown field={runSpecSizeField} disabled={processing} fluid={false} selection />
            <DropDown field={runSpecTargetField} disabled={processing} fluid={false} selection />
            <Divider horizontal className="mb3">
              <Header as="h4" className="color-grey">
                <Icon name="list alternate outline" className="color-grey" />
                Properties Override
              </Header>
            </Divider>
            <Segment padded>
              <PropsOverrideTable rows={fields} editable processing={processing} />
            </Segment>
            <div className="mt4">
              <Button
                floated="right"
                color="teal"
                icon="right arrow"
                labelPosition="right"
                disabled={processing}
                className="ml2"
                content="Next"
                onClick={e => this.handleOnSubmitNext(e, onSubmit)}
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
              />
              <Button floated="left" disabled={processing} onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Form>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowTemplateDraftMetaEditor, {
  handleCancel: action,
  handleOnSubmitNext: action,
  handleFormSubmission: action,
  handleFormErrors: action,
  handlePrevious: action,
  resetFlags: action,
  clickedOnNext: observable,
});

export default inject()(observer(WorkflowTemplateDraftMetaEditor));
