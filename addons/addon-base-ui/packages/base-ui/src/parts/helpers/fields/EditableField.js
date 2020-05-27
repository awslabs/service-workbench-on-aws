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

import { observer } from 'mobx-react';
import React from 'react';
import { decorate, action, observable, runInAction } from 'mobx';
import _ from 'lodash';

import { displayError } from '../../../helpers/notification';
import Form from './Form';

// expected props
// - form -- A single field Mobx Form specific to this field.
// - renderFieldForView -- Called to render the field in "view" mode.
// - renderFieldForEdit -- Called to render the field in "edit" mode.
// - onSubmit - optional -- Called when form specific to this field is submitted
// - onCancel - optional -- Called when the field is being canceled for edit (i.e., transitioning from edit mode to view mode)
// - onError - optional -- Called when any error occurs when processing the form (may be validation errors)
/**
 * A field component that can be used for places where you require single field edits (such as inline edits).
 * The field handles switching between "view" mode and "edit" mode.
 */
class EditableField extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.editorOn = false;
    });
  }

  render() {
    if (this.editorOn) return this.renderEditMode();
    return this.renderViewMode();
  }

  renderEditMode() {
    const form = this.props.form;
    const renderFieldForEdit = this.props.renderFieldForEdit;
    return (
      <Form
        form={form}
        onCancel={this.handleCancel}
        onSuccess={this.handleFormSubmission}
        onError={this.handleFormError}
      >
        {({ processing, onSubmit, onCancel }) => renderFieldForEdit({ processing, onSubmit, onCancel })}
      </Form>
    );
  }

  renderViewMode() {
    return this.props.renderFieldForView({ onEditorOn: this.handleEditorOn });
  }

  handleEditorOn = action(() => {
    this.editorOn = true;
  });

  handleFormSubmission = action(async form => {
    try {
      await this.notifyHandler(this.props.onSubmit, form);
      runInAction(() => {
        this.editorOn = false;
      });
    } catch (error) {
      displayError(error);
      form.clear();
      runInAction(() => {
        this.editorOn = false;
      });
    }
  });

  handleCancel = action(async () => {
    this.editorOn = false;

    // notify onCancel
    await this.notifyHandler(this.props.onCancel);
  });

  handleFormError = action(async (form, errors) => {
    await this.notifyHandler(this.props.onError, form, errors);
  });

  notifyHandler = async (handlerFn, ...args) => {
    const handlerFnToNotify = handlerFn || _.noop;
    await handlerFnToNotify(...args);
  };
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(EditableField, {
  editorOn: observable,
});

export default observer(EditableField);
