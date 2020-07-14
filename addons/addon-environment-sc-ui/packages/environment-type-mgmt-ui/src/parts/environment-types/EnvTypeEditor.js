import _ from 'lodash';
import React from 'react';
import { inject, observer, Observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { computed, decorate, observable, runInAction } from 'mobx';
import { Container, Header, Icon, Step, Tab } from 'semantic-ui-react';

import Stores from '@aws-ee/base-ui/dist/models/Stores';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { isStoreLoading, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { createWizard } from '@aws-ee/base-ui/dist/models/Wizard';
import BasicInfoStep from './env-type-editor-steps/BasicInfoStep';
import ConfigStep from './env-type-editor-steps/ConfigStep';

// This component is used with the TabPane to replace the default Segment wrapper since
// we don't want to display the border.
function TabPaneWrapper(props) {
  return <>{props.children}</>;
}

class EnvTypeEditor extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([this.envTypeCandidatesStore, this.envTypesStore]);
      this.wizardModel = createWizard([
        {
          key: 'basic_information',
          title: 'Basic Information',
          desc: 'Enter basic information about the Environment Type',
          isComplete: false,
        },
        {
          key: 'configurations',
          title: 'Configurations',
          desc: 'Define configurations with predefined set of AWS CloudFormation Input Parameter values',
          isComplete: false,
        },
      ]);
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

    return <Container className="mt3 mb4">{content}</Container>;
  }

  renderTitle = () => {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="computer" className="align-top" />
          <Header.Content className="left-align">
            {this.isEditAction() ? 'Edit' : 'Import'} Workspace Type
          </Header.Content>
          <Header.Subheader className="mt2">{this.envType.name}</Header.Subheader>
        </Header>
      </div>
    );
  };

  renderContent = () => {
    return (
      <>
        {this.renderTitle()}
        {// When importing new env type, render the wizard as steps with linear flow
        // When updating existing env type, render the wizard steps as tabs to allow random access
        this.isImportAction() ? (
          <>
            {this.renderStepProgress()}
            {this.renderCurrentStep()}
          </>
        ) : (
          this.renderStepTabs()
        )}
      </>
    );
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

  renderStepTabs = () => {
    const stepPanes = _.map(this.wizardModel.steps, step => ({
      menuItem: step.title,
      render: () => (
        <Tab.Pane attached={false} key={step.key} as={TabPaneWrapper}>
          <Observer>{() => this.renderEnvTypeStep(step.key)}</Observer>
        </Tab.Pane>
        // <Observer>{() => this.renderEnvTypeStep(step.key)}</Observer>
      ),
    }));
    return <Tab className="mt3" menu={{ secondary: true, pointing: true }} renderActiveOnly panes={stepPanes} />;
  };

  renderCurrentStep = () => {
    return this.renderEnvTypeStep(this.wizardModel.currentStep.key);
  };

  renderEnvTypeStep(stepKey) {
    switch (stepKey) {
      case 'basic_information':
        return (
          <BasicInfoStep
            envTypesStore={this.envTypesStore}
            envType={this.envType}
            wizardModel={this.wizardModel}
            workspaceTypeAction={this.getAction()}
            onCancel={this.handleCancel}
            onEnvTypeSaveComplete={this.handleDone}
          />
        );
      case 'configurations':
        return (
          <ConfigStep
            envType={this.envType}
            envTypeConfigsStore={this.getEnvTypeConfigsStore()}
            wizardModel={this.wizardModel}
            workspaceTypeAction={this.getAction()}
            onCancel={this.handleCancel}
            onEnvTypeSaveComplete={this.handleDone}
          />
        );
      default:
        return undefined;
    }
  }

  handleCancel = () => {
    const goto = gotoFn(this);
    goto(`/workspace-types-management`);
  };

  handleDone = () => {
    this.handleCancel();
  };

  isEditAction() {
    return this.getAction() === 'edit';
  }

  isImportAction() {
    return this.getAction() === 'import';
  }

  getEnvTypeConfigsStore() {
    return this.envTypesStore.getEnvTypeConfigsStore(this.getEnvTypeId());
  }

  getEnvTypeId() {
    return decodeURIComponent((this.props.match.params || {}).id);
  }

  getAction() {
    return decodeURIComponent((this.props.match.params || {}).action);
  }

  get envType() {
    const id = this.getEnvTypeId();
    // env type
    const envType = this.envTypesStore.getEnvType(id);
    if (!envType && this.isImportAction()) {
      // Importing env type candidate as new env type, the envType may not exist yet in that case (if this is the first step in the wizard)
      // Returning env type candidate in that case containing subset of env type information
      const envTypeCandidate = this.envTypeCandidatesStore.getEnvTypeCandidate(id);
      return envTypeCandidate;
    }
    return envType;
  }

  get envTypeCandidatesStore() {
    return this.props.envTypeCandidatesStore;
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }
}

decorate(EnvTypeEditor, {
  envTypesStore: computed,
  envType: computed,
  envTypeCandidatesStore: computed,
  stores: observable,

  steps: observable,
  currentStepNo: observable,
});

export default inject('envTypesStore', 'envTypeCandidatesStore')(withRouter(observer(EnvTypeEditor)));
