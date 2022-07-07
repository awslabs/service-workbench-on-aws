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

import React from 'react';
import { runInAction } from 'mobx';
import { observer } from 'mobx-react';
import { Button, Segment } from 'semantic-ui-react';

import Input from '@amzn/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@amzn/base-ui/dist/parts/helpers/fields/TextArea';
import Form from '@amzn/base-ui/dist/parts/helpers/fields/Form';

import { displayError, displaySuccess } from '@amzn/base-ui/dist/helpers/notification';
import { getAddEnvTypeBasicInfoForm } from '../../../models/forms/EnvTypeBasicInfoForm';
import EnvTypeStatusEnum from '../../../models/environment-types/EnvTypeStatusEnum';

class BasicInfoStep extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = getAddEnvTypeBasicInfoForm(props.envType);
    });
  }

  render() {
    const form = this.form;
    return (
      <Segment clearing className="mt3 p3">
        <Form form={form} onCancel={this.props.onCancel} onSuccess={this.handleFormSubmission}>
          {({ processing, onCancel }) => (
            <>
              {this.renderFormFields({ form, processing, onCancel })}
              {this.renderActionButtons({ processing, onCancel })}
            </>
          )}
        </Form>
      </Segment>
    );
  }

  renderActionButtons({ processing, onCancel }) {
    const isEditing = this.isEditAction();
    return (
      <div className="right-align">
        <Button basic color="grey" disabled={processing} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="ml2"
          primary
          content={isEditing ? 'Save Workspace Type' : 'Import Workspace Type'}
          disabled={processing}
          // Every wizard step page has has it's own form
          // The submit handler is responsible for saving the information and/or navigating to the next step (if there is next step)
          type="submit"
        />
      </div>
    );
  }

  isEditAction() {
    return this.props.workspaceTypeAction === 'edit';
  }

  isImportAction() {
    return this.props.workspaceTypeAction === 'import';
  }

  renderFormFields({ form, processing }) {
    const nameField = form.$('name');
    const descField = form.$('desc');
    return (
      <>
        <Input field={nameField} disabled={processing} />
        <TextArea field={descField} disabled={processing} />
      </>
    );
  }

  handleFormSubmission = async form => {
    const envType = this.props.envType;
    const envTypesStore = this.props.envTypesStore;

    const name = form.$('name').value;
    const desc = form.$('desc').value;

    let savedEnvType;
    try {
      if (this.isImportAction()) {
        // if importing new env type then call "create"
        savedEnvType = await envTypesStore.createEnvType({
          id: envType.id,
          name,
          desc,
          status: EnvTypeStatusEnum.notApproved,
          product: envType.product,
          provisioningArtifact: envType.provisioningArtifact,
          params: envType.params,
        });
        displaySuccess(`Imported Workspace Type ${envType.name} successfully`);

        // Navigate to next step (if there is) or call onEnvTypeSaveComplete to notify
        // that this was last step and we are done creating env type
        const wizardModel = this.props.wizardModel;
        if (wizardModel.hasNext) {
          wizardModel.next();
        } else {
          await this.props.onEnvTypeSaveComplete(savedEnvType);
        }
      } else {
        // if updating existing env type then call "update" and call onEnvTypeSaveComplete to notify that we are done
        // saving env type
        savedEnvType = await envTypesStore.updateEnvType({
          ...envType,
          name,
          desc,
        });
        displaySuccess(`Updated Workspace Type ${envType.name} successfully`);

        await this.props.onEnvTypeSaveComplete(savedEnvType);
      }
    } catch (error) {
      displayError(error);
    }
  };
}
export default observer(BasicInfoStep);
