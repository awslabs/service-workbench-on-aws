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
import { decorate, action, computed } from 'mobx';
import { Segment, Icon, Divider, Header } from 'semantic-ui-react';
import ConfigTable from '@amzn/base-ui/dist/parts/configuration/ConfigTable';
import ConfigurationEditor from '@amzn/base-ui/dist/parts/configuration/ConfigurationEditor';
import ConfigurationReview from '@amzn/base-ui/dist/parts/configuration/ConfigurationReview';

// expected props
// - stepEditor - a WorkflowStepEditor or a WorkflowTemplateStepEditor model instance (via props)
// - onSave - called when the configuration is saved (via props)
// - className (via props)
class WorkflowCommonStepConfigEditor extends React.Component {
  getStepEditor() {
    return this.props.stepEditor;
  }

  getStep() {
    return this.getStepEditor().step;
  }

  get editing() {
    return this.getStepEditor().configEdit;
  }

  handleEditOn = event => {
    event.preventDefault();
    event.stopPropagation();

    const stepEditorModel = this.getStepEditor();
    stepEditorModel.setConfigEdit(true);
  };

  handleEditOff = () => {
    const stepEditorModel = this.getStepEditor();
    stepEditorModel.setConfigEdit(false);
  };

  handleSave = async configs => {
    const onSave = this.props.onSave || _.noop;
    const stepEditorModel = this.getStepEditor();

    await onSave(configs);
    stepEditorModel.setConfigEdit(false);
  };

  render() {
    const editing = this.editing;
    const step = this.getStep();
    const configRows = step.configSummaryRows || [];
    const hasConfigRows = configRows.length > 0;
    const canEdit = !editing && hasConfigRows;

    return (
      <div className={this.props.className}>
        {!editing && (
          <div className="flex animated">
            <div className="flex-auto">
              <Icon name="cog" className="mr1 color-grey" />
              <b>Configuration</b>
            </div>
            {canEdit && (
              <div className="pl1 pr0" onClick={this.handleEditOn}>
                <Icon name="edit" color="grey" className="cursor-pointer" />
              </div>
            )}
          </div>
        )}
        <Divider className="mt1 mb2" />
        {editing && this.renderConfigEditingContent()}
        {!editing && this.renderConfigContent()}
      </div>
    );
  }

  renderConfigContent() {
    const step = this.getStep();
    const configRows = step.configSummaryRows || [];
    const hasConfigRows = configRows.length > 0;

    return (
      <>
        {hasConfigRows && (
          <Segment padded className="animated">
            <ConfigTable rows={configRows} />
          </Segment>
        )}
        {!hasConfigRows && <div>No configuration entries are available</div>}
      </>
    );
  }

  renderConfigEditingContent() {
    const model = this.getStepEditor().configurationEditor;
    const review = model.review;

    if (review) {
      return (
        <>
          <Header textAlign="center" as="h2" color="grey" className="mt1 mb3">
            Review Configuration Changes
          </Header>
          <ConfigurationReview model={model} onCancel={this.handleEditOff} onSave={this.handleSave} dimmer={false} />
        </>
      );
    }

    return (
      <>
        <Header textAlign="center" as="h2" color="grey" className="mt1 mb3">
          Change Configuration
        </Header>
        <ConfigurationEditor model={model} onCancel={this.handleEditOff} />
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowCommonStepConfigEditor, {
  editing: computed,
  handleEditOn: action,
  handleEditOff: action,
  handleSave: action,
});

export default inject()(observer(WorkflowCommonStepConfigEditor));
