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
import { Label, Segment, Button } from 'semantic-ui-react';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import { isStoreLoading, isStoreReady, isStoreError } from '@aws-ee/base-ui/dist/models/BaseStore';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import DropDown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';

import getCreateDraftForm from '../../../models/forms/CreateWorkflowTemplateDraftForm';
import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';

// expected props
// - onCancel (via prop) called on cancel
// - workflowTemplateDraftsStore (via injection)
// - workflowTemplatesStore (via injection)
// - className (via props)
// - location (from react router)
class CreateWorkflowTemplateDraft extends React.Component {
  constructor(props) {
    super(props);
    this.form = getCreateDraftForm();
  }

  getStore() {
    return this.props.workflowTemplateDraftsStore;
  }

  getTemplatesStore() {
    return this.props.workflowTemplatesStore;
  }

  getDropdownOptions() {
    const store = this.getTemplatesStore();
    const draftsStore = this.getStore();
    const templates = store.list;
    const options = [];

    _.forEach(templates, template => {
      if (!draftsStore.hasTemplate(template.id)) {
        options.push({
          text: template.latest.title || '',
          value: template.id,
          content: (
            <div>
              <Label color="teal" horizontal size="mini">
                Existing
              </Label>{' '}
              {template.latest.title} <span className="ml1 fs-7 color-grey">{template.id}</span>
            </div>
          ),
        });
      }
    });

    options.unshift({
      text: 'New Workflow Template',
      value: '-1',
      content: (
        <div>
          <Label color="blue" horizontal size="mini">
            New
          </Label>{' '}
          Workflow Template
        </div>
      ),
    });

    return options;
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });

    this.props.history.push(link);
  }

  handleSelectionChange = templateId => {
    const form = this.form;
    const templateIdField = form.$('templateId');
    const templateTitleField = form.$('templateTitle');
    const clear = () => {
      templateIdField.clear();
      templateTitleField.clear();
    };
    const set = template => {
      templateIdField.set(template.id);
      templateTitleField.set(template.latest.title);
    };

    if (templateId === '-1') {
      clear();
    } else {
      const store = this.getTemplatesStore();
      const template = store.getTemplate(templateId);
      if (_.isNil(template)) {
        displayError(`The template "${templateId}" is no longer available.`);
        clear();
      } else {
        set(template);
      }
    }
  };

  handleCancel = () => {
    const onCancel = this.props.onCancel || _.noop;
    onCancel();
  };

  handleFormError = (_form, _errors) => {
    // We don't need to do anything here
  };

  handleFormSubmission = async form => {
    const values = form.values();
    const isNewTemplate = values.draftFor === '-1';
    const templateId = values.templateId;
    const templateTitle = isNewTemplate ? values.templateTitle : undefined;
    const store = this.getStore();

    try {
      const draft = await store.createDraft({ isNewTemplate, templateId, templateTitle });
      form.clear();
      this.goto(`/workflow-templates/drafts/edit/${encodeURIComponent(draft.id)}`);
    } catch (error) {
      displayError(error);
    }
  };

  render() {
    const store = this.getStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0 mb3" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return content;
  }

  renderMain() {
    const form = this.form;
    const dropDownOptions = this.getDropdownOptions();
    const dropDownField = form.$('draftFor');
    const templateIdField = form.$('templateId');
    const templateTitleField = form.$('templateTitle');
    const draftForValue = dropDownField.value;
    const isNew = draftForValue === '-1';

    return (
      <Segment clearing className="p3">
        <Form
          form={form}
          onCancel={this.handleCancel}
          onSuccess={this.handleFormSubmission}
          onError={this.handleFormError}
        >
          {({ processing, _onSubmit, onCancel }) => (
            <>
              <DropDown
                field={dropDownField}
                options={dropDownOptions}
                fluid
                selection
                disabled={processing}
                onChange={this.handleSelectionChange}
              />
              {isNew && (
                <>
                  <Input field={templateIdField} disabled={processing} />
                  <Input field={templateTitleField} disabled={processing} />
                </>
              )}
              <div className="mt3">
                <Button floated="right" color="blue" icon disabled={processing} className="ml2" type="submit">
                  Create Draft
                </Button>
                <Button floated="right" disabled={processing} onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Form>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(CreateWorkflowTemplateDraft, {
  handleCancel: action,
  handleFormSubmission: action,
  handleFormError: action,
});

export default inject(
  'workflowTemplateDraftsStore',
  'workflowTemplatesStore',
)(withRouter(observer(CreateWorkflowTemplateDraft)));
