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
import { decorate, action, runInAction, computed } from 'mobx';
import { withRouter } from 'react-router-dom';
import { Label, Segment, Button, Message } from 'semantic-ui-react';
import { isStoreEmpty } from '@amzn/base-ui/dist/models/BaseStore';
import { gotoFn } from '@amzn/base-ui/dist/helpers/routing';
import { displayError } from '@amzn/base-ui/dist/helpers/notification';
import Stores from '@amzn/base-ui/dist/models/Stores';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';
import Form from '@amzn/base-ui/dist/parts/helpers/fields/Form';
import DropDown from '@amzn/base-ui/dist/parts/helpers/fields/DropDown';
import Input from '@amzn/base-ui/dist/parts/helpers/fields/Input';

import getCreateDraftForm from '../../../models/forms/CreateWorkflowDraftForm';
import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';

// expected props
// - onCancel (via prop) called on cancel
// - workflowsStore (via injection)
// - workflowDraftsStore (via injection)
// - workflowTemplatesStore (via injection)
// - className (via props)
// - location (from react router)
class CreateWorkflowDraft extends React.Component {
  constructor(props) {
    super(props);
    this.form = getCreateDraftForm();
    runInAction(() => {
      this.stores = new Stores([this.getWorkflowsStore(), this.getDraftsStore(), this.getTemplatesStore()]);
    });
  }

  componentDidMount() {
    this.getStores().load();
  }

  get emptyWorkflows() {
    const store = this.getWorkflowsStore();
    return isStoreEmpty(store);
  }

  get emptyWorkflowTemplates() {
    const store = this.getTemplatesStore();
    return isStoreEmpty(store);
  }

  getStores() {
    return this.stores;
  }

  getWorkflowsStore() {
    return this.props.workflowsStore;
  }

  getDraftsStore() {
    return this.props.workflowDraftsStore;
  }

  getTemplatesStore() {
    return this.props.workflowTemplatesStore;
  }

  getDraftForDropDownOptions() {
    const hasWorkflows = !this.emptyWorkflows;
    const hasTemplates = !this.emptyWorkflowTemplates;
    const options = [];

    if (hasWorkflows) {
      options.push({
        value: 'existingWorkflow',
        text: 'An existing workflow',
        content: (
          <div>
            <Label color="teal" horizontal size="mini">
              Existing
            </Label>{' '}
            An existing workflow
          </div>
        ),
      });
    }

    if (hasTemplates) {
      options.push({
        value: 'newWorkflow',
        text: 'A new workflow',
        content: (
          <div>
            <Label color="blue" horizontal size="mini">
              New
            </Label>{' '}
            An new workflow
          </div>
        ),
      });
    }

    return options;
  }

  getWorkflowDropDownOptions() {
    const workflowsStore = this.getWorkflowsStore();
    const draftsStore = this.getDraftsStore();
    const workflows = workflowsStore.list;
    const options = [];

    // TODO the approach of looping through all the entries in the workflowsStore is not going to scale beyond 5000 workflows, we need an autocomplete approach
    // for this
    _.forEach(workflows, workflow => {
      if (!draftsStore.hasWorkflow(workflow.id)) {
        options.push({
          text: workflow.latest.title || '',
          value: workflow.id,
          content: (
            <div>
              <Label color="teal" horizontal size="mini">
                Existing
              </Label>{' '}
              {workflow.latest.title} <span className="ml1 fs-7 color-grey">{workflow.id}</span>
            </div>
          ),
        });
      }
    });

    return options;
  }

  getWorkflowTemplatesDropDownOptions() {
    const templatesStore = this.getTemplatesStore();
    const templates = templatesStore.list;
    const options = [];

    _.forEach(templates, template => {
      options.push({
        text: template.latest.title || '',
        value: template.id,
        content: (
          <div>
            <Label color="teal" horizontal size="mini">
              Template
            </Label>{' '}
            {template.latest.title} <span className="ml1 fs-7 color-grey">{template.id}</span>
          </div>
        ),
      });
    });

    return options;
  }

  handleDraftForSelectionChange = selection => {
    const form = this.form;
    const templateIdField = form.$('templateId');
    const workflowIdField = form.$('workflowId');
    const clear = () => {
      templateIdField.clear();
      workflowIdField.clear();
    };

    clear();

    if (selection === 'existingWorkflow') {
      templateIdField.set('__DO_NOT_USE__');
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
    const draftForValue = values.draftFor;
    const isNewWorkflow = draftForValue === 'newWorkflow';

    const templateId = isNewWorkflow ? values.templateId : undefined;
    const workflowId = values.workflowId;
    const draftsStore = this.getDraftsStore();
    const goto = gotoFn(this);

    try {
      const draft = await draftsStore.createDraft({ isNewWorkflow, workflowId, templateId });
      form.clear();
      this.handleCancel();
      goto(`/workflows/drafts/edit/${encodeURIComponent(draft.id)}`);
    } catch (error) {
      displayError(error);
    }
  };

  render() {
    const stores = this.getStores();
    let content = null;

    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0 mb3" />;
    } else if (stores.loading) {
      content = <ProgressPlaceHolder />;
    } else if (stores.ready) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return content;
  }

  renderMain() {
    const form = this.form;
    const draftForDropDownOptions = this.getDraftForDropDownOptions();
    const workflowDropDownOptions = this.getWorkflowDropDownOptions();
    const templatesDropDownOptions = this.getWorkflowTemplatesDropDownOptions();
    const dropDownField = form.$('draftFor');
    const templateIdField = form.$('templateId');
    const workflowIdField = form.$('workflowId');
    const draftForValue = dropDownField.value;
    const isNewWorkflow = draftForValue === 'newWorkflow';
    const isExistingWorkflow = draftForValue === 'existingWorkflow';
    const empty = this.emptyWorkflowTemplates && this.emptyWorkflows;

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
              {empty && this.renderEmptyMessage()}
              <DropDown
                field={dropDownField}
                options={draftForDropDownOptions}
                selection
                fluid
                disabled={processing}
                onChange={this.handleDraftForSelectionChange}
              />
              {!empty && isNewWorkflow && (
                <>
                  <DropDown
                    field={templateIdField}
                    options={templatesDropDownOptions}
                    selection
                    fluid
                    disabled={processing}
                  />
                  <Input field={workflowIdField} disabled={processing} />
                </>
              )}
              {!empty && isExistingWorkflow && (
                <DropDown
                  field={workflowIdField}
                  options={workflowDropDownOptions}
                  selection
                  fluid
                  disabled={processing}
                />
              )}
              <div className="mt3">
                <Button floated="right" color="blue" icon disabled={processing || empty} className="ml2" type="submit">
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

  renderEmptyMessage() {
    return (
      <Message warning style={{ display: 'block' }}>
        <Message.Header>Brand new system</Message.Header>
        <p>
          This is a brand new installation of the data lake. There are no workflow templates or workflows to create a
          draft from. At least one workflow template needs to be created before you can create a workflow draft.
        </p>
      </Message>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(CreateWorkflowDraft, {
  emptyWorkflows: computed,
  emptyWorkflowTemplates: computed,
  handleDraftForSelectionChange: action,
  handleCancel: action,
  handleFormSubmission: action,
  handleFormError: action,
});

export default inject(
  'workflowsStore',
  'workflowDraftsStore',
  'workflowTemplatesStore',
)(withRouter(observer(CreateWorkflowDraft)));
