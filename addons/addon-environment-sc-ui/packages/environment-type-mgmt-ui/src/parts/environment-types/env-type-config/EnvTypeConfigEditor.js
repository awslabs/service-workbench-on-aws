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
import { inject, Observer, observer } from 'mobx-react';
import { action, computed, decorate, observable, runInAction } from 'mobx';
import { Header, Icon, Step, Tab } from 'semantic-ui-react';

import Stores from '@aws-ee/base-ui/dist/models/Stores';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { isStoreLoading, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';

import { createWizard } from '@aws-ee/base-ui/dist/models/Wizard';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import { sessionStore } from '@aws-ee/base-ui/dist/models/SessionStore';
import { getEnvTypeConfigForm } from '../../../models/forms/EnvTypeConfigForm';
import BasicInfoStep from './env-type-config-steps/BasicInfoStep';
import AccessControlStep from './env-type-config-steps/AccessControlStep';
import InputParamsStep from './env-type-config-steps/InputParamsStep';
import TagsStep from './env-type-config-steps/TagsStep';

const steps = [
  {
    key: 'basic_information',
    title: 'Basic Information',
    desc: 'Enter basic information',
    isComplete: false,
    stepComponent: BasicInfoStep,
  },
  {
    key: 'access_control',
    title: 'Access Control',
    desc: 'Define who can access',
    isComplete: false,
    stepComponent: AccessControlStep,
  },
  {
    key: 'input_params',
    title: 'Input Parameters',
    desc: 'Provide AWS CloudFormation Inputs',
    isComplete: false,
    stepComponent: InputParamsStep,
  },
  {
    key: 'tags',
    title: 'Tags',
    desc: 'Specify Resource Tags',
    isComplete: false,
    stepComponent: TagsStep,
  },
];
const wizardTempStoreKeyPrefix = 'EnvTypeConfigEditor-TempStore';

function clearState() {
  sessionStore.removeStartsWith(wizardTempStoreKeyPrefix);
}

class EnvTypeConfigEditor extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([this.envTypeConfigsStore, this.userRolesStore]);
      this.form = getEnvTypeConfigForm(props.envTypeConfig);
      this.wizardModel = createWizard(_.map(steps, s => _.omit(s, 'stepComponent')));
    });
  }

  componentDidMount() {
    swallowError(this.stores.load());
  }

  render() {
    const stores = this.stores;
    let content = null;
    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0 mb3" />;
    } else if (isStoreLoading(stores)) {
      content = <BasicProgressPlaceholder />;
    } else if (isStoreReady(stores)) {
      content = this.renderContent();
    } else {
      content = null;
    }

    return (
      <div className="ml3 mt3 mr3 mb4">
        {this.renderTitle()}
        {content}
      </div>
    );
  }

  renderTitle = () => {
    const envTypConfig = this.envTypeConfig;
    const isUpdating = !_.isEmpty(envTypConfig);
    return (
      <div className="mb3">
        <Header as="h3" className="color-grey mt1 mb0">
          <Icon name="settings" className="align-top" />
          <Header.Content className="left-align">{isUpdating ? 'Edit' : 'Add'} Configuration</Header.Content>
          {isUpdating && <Header.Subheader className="mt2">{envTypConfig.name}</Header.Subheader>}
        </Header>
      </div>
    );
  };

  renderContent = () => {
    const envTypConfig = this.envTypeConfig;
    const isUpdating = !_.isEmpty(envTypConfig);
    return (
      // Render as tabs when updating configuration,
      // Render as wizard when adding configuration
      <>
        {isUpdating ? (
          this.renderStepTabs()
        ) : (
          <>
            {this.renderStepProgress()}
            {this.renderCurrentStep()}
          </>
        )}
      </>
    );
  };

  renderStepTabs = () => {
    const stepPanes = _.map(this.wizardModel.steps, step => ({
      menuItem: step.title,
      render: () => <Observer>{() => this.renderEnvTypeConfigStep(step.key)}</Observer>,
    }));
    return <Tab className="mt3" menu={{ secondary: true, pointing: true }} renderActiveOnly panes={stepPanes} />;
  };

  renderStepProgress = () => {
    return (
      <Step.Group ordered className="container">
        {_.map(this.wizardModel.steps, step => {
          const stepAttribs = {
            key: step.key,
            completed: step.isComplete,
            active: this.wizardModel.isStepActive(step.key),
          };
          return (
            <Step {...stepAttribs}>
              <Step.Content>
                <Step.Title>{step.title}</Step.Title>
                <Step.Description>{step.desc}</Step.Description>
              </Step.Content>
            </Step>
          );
        })}
      </Step.Group>
    );
  };

  renderCurrentStep = () => {
    return this.renderEnvTypeConfigStep(this.wizardModel.currentStep.key);
  };

  renderEnvTypeConfigStep(stepKey) {
    const step = _.find(steps, { key: stepKey });
    const StepComponentClass = _.get(step, 'stepComponent');
    return (
      <StepComponentClass
        form={this.form}
        wizardModel={this.wizardModel}
        onCancel={() => {
          clearState();
          this.props.onCancel();
        }}
        onSubmit={this.handleFormSubmission}
        envTypeConfig={this.envTypeConfig}
        envType={this.envType}
        envTypeConfigsStore={this.envTypeConfigsStore}
        onPrevious={this.handlePreviousClick}
        // steps can store temporary information in session store with the following key prefix
        // see InputParamsStep as an example, it needs to create a different mobx form specifically for cfn params
        // the values entered for that form will wipe out on next/previous click as the component gets unmounted/mounted
        // to preserve those values outside of the step component the step component can save the info in session store
        // with this key prefix
        // This component (i.e., EnvTypeConfigEditor) will take care of clearing session keys with this prefix upon
        // completion or cancel
        wizardTempStoreKeyPrefix={wizardTempStoreKeyPrefix}
      />
    );
  }

  handlePreviousClick = () => {
    this.wizardModel.previous();
  };

  handleFormSubmission = async form => {
    const existingEnvTypeConfig = this.envTypeConfig;
    const isUpdating = !_.isEmpty(existingEnvTypeConfig);

    const {
      id,
      name,
      desc,
      estimatedCostInfo,
      allowRoleIds,
      denyRoleIds,
      params: paramsJsonStr,
      tags: tagsJsonStr,
    } = form.values();

    let existingParams;
    let existingTags;
    if (isUpdating) {
      existingParams = existingEnvTypeConfig.params;
      existingTags = existingEnvTypeConfig.tags;
    }

    // The params and tags fields are submitted as JSON string via the form
    const params = !_.isEmpty(paramsJsonStr) ? JSON.parse(paramsJsonStr) : existingParams;

    // The updatedTags below has [{name,value}] form. Translate it to [{key,value}]
    const updatedTags = JSON.parse(tagsJsonStr || '[]') || [];
    const fromNameValueToKeyValue = nameValue => ({ key: nameValue.key || nameValue.name, value: nameValue.value });
    const tags = !_.isEmpty(tagsJsonStr) ? _.map(updatedTags, fromNameValueToKeyValue) : existingTags;

    const envTypeConfig = {
      id,
      ...(existingEnvTypeConfig || {}),
      name,
      desc,
      estimatedCostInfo,
      allowRoleIds: allowRoleIds || [],
      denyRoleIds: denyRoleIds || [],
      params,
      tags,
    };

    try {
      if (!isUpdating && this.wizardModel.hasNext) {
        // When creating configuration, do not submit to server just yet,
        // show next screen if there is one
        // Will submit to server at the end
        return this.wizardModel.next();
      }

      let savedEnvTypeConfig;
      if (isUpdating) {
        savedEnvTypeConfig = await this.envTypeConfigsStore.updateEnvTypeConfig(envTypeConfig);
        displaySuccess(`Successfully updated ${envTypeConfig.name} configuration`);
      } else {
        savedEnvTypeConfig = await this.envTypeConfigsStore.createEnvTypeConfig(envTypeConfig);
      }
      clearState();

      this.props.onEnvTypeConfigSaveComplete(savedEnvTypeConfig);
      return savedEnvTypeConfig;
    } catch (error) {
      displayError(error);
    }
    return undefined;
  };

  get envTypeConfigsStore() {
    return this.props.envTypeConfigsStore;
  }

  get userRolesStore() {
    return this.props.userRolesStore;
  }

  get envType() {
    return this.props.envType;
  }

  get envTypeConfig() {
    return this.props.envTypeConfig;
  }
}

decorate(EnvTypeConfigEditor, {
  userRolesStore: computed,
  envTypeConfigsStore: computed,
  envTypeConfig: computed,
  envType: computed,

  handleFormSubmission: action,

  stores: observable,
});
export default inject('userRolesStore')(observer(EnvTypeConfigEditor));
