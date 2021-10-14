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
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Icon, Header, Segment, Button } from 'semantic-ui-react';
import { isStoreLoading, isStoreError, isStoreEmpty } from '@aws-ee/base-ui/dist/models/BaseStore';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import Stores from '@aws-ee/base-ui/dist/models/Stores';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import UserOnboarding from '../../users/UserOnboarding';
import SelectEnvTypeStep from './SelectEnvTypeStep';
import ConfigureEnvTypeStep from './ConfigureEnvTypeStep';

// expected props
// - onPrevious (via props)
// - onCompleted (via props) a function is called after a call to create an environment is performed
// - studyIds (via props) (optional) an array of the selected study ids
// - envTypeId (via props) (optional) id of the env type
// - envTypeImmutable (via props) (optional) flag indicating if env type is immutable and env type selection should be disallowed
// - currentStep (via props) an instance of the CurrentStep model
// - envTypesStore (via injection)
// - clientInformationStore (via injection)
class ScEnvironmentSetup extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([this.envTypesStore, this.clientInformationStore]);
      this.selectedTypeId = props.envTypeId;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    swallowError(this.stores.load());
  }

  get userStore() {
    return this.props.userStore;
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }

  get clientInformationStore() {
    return this.props.clientInformationStore;
  }

  get currentStep() {
    return this.props.currentStep;
  }

  setOnboarding = value => {
    this.onboardingOpen = value;
  };

  handleConfigureCredentials = event => {
    event.preventDefault();
    event.stopPropagation();
    this.setOnboarding(true);
  };

  handleSelectEnvType = async envTypeId => {
    this.selectedTypeId = envTypeId;
    const envTypesStore = this.envTypesStore;
    if (!envTypesStore) return;

    // We start the loading of the configurations for the selected type
    const configurationStore = this.envTypesStore.getEnvTypeConfigsStore(envTypeId);
    await configurationStore.load();

    window.scrollTo(0, 0);
    runInAction(() => {
      this.currentStep.setStep('selectEnvConfig');
    });
  };

  goto(pathname) {
    const goto = gotoFn(this);
    goto(pathname);
  }

  handlePrevious = () => {
    const currentStep = this.currentStep;
    if (currentStep.step === 'selectEnvType' || this.props.envTypeImmutable) {
      this.props.onPrevious();
    } else {
      this.currentStep.setStep('selectEnvType');
    }
  };

  handleCompleted = async environment => {
    return this.props.onCompleted(environment);
  };

  get studyIds() {
    return this.props.studyIds;
  }

  render() {
    const store = this.envTypesStore;
    let content = null;

    if (isStoreError(store)) {
      content = this.renderLoadingError();
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder className="mt2" />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else {
      content = this.renderContent();
    }

    return (
      <>
        {content} {this.onboardingOpen && <UserOnboarding onclose={() => this.setOnboarding(false)} />}
      </>
    );
  }

  renderContent() {
    const step = this.currentStep.step;
    const typeId = this.selectedTypeId;
    const studyIds = this.studyIds;
    const user = this.userStore.user;
    const hasProjects = user.hasProjects;
    const isExternalResearcher = user.isExternalResearcher;
    const canCreateWorkspace = user.capabilities.canCreateWorkspace;
    const hasCredentials = user.hasCredentials;
    let content = null;

    if (!canCreateWorkspace) {
      return this.renderEmpty();
    }

    if (!isExternalResearcher && !hasProjects) {
      return this.renderMissingProjects();
    }

    // Check if external and no credentials
    // TODO - service catalog (sc) workspaces don't support external researchers
    if (isExternalResearcher && !hasCredentials) {
      return this.renderMissingCredentials();
    }

    if (step === 'selectEnvType') {
      content = <SelectEnvTypeStep onPrevious={this.handlePrevious} onNext={this.handleSelectEnvType} />;
    } else if (step === 'selectEnvConfig') {
      content = (
        <ConfigureEnvTypeStep
          envTypeId={typeId}
          studyIds={studyIds}
          onPrevious={this.handlePrevious}
          onCompleted={this.handleCompleted}
        />
      );
    }

    return content;
  }

  renderLoadingError() {
    const store = this.envTypesStore;
    return (
      <>
        <ErrorBox error={store.error} className="p0 mt2 mb3" />
        {this.renderButtons()}
      </>
    );
  }

  renderEmpty() {
    return (
      <>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="server" />
            No workspace types
            <Header.Subheader>
              There are no workspace types to choose from. Your role might be restricted. Please contact your
              administrator.
            </Header.Subheader>
          </Header>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderMissingProjects() {
    return (
      <>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="lock" />
            Missing association with projects
            <Header.Subheader>
              You currently do not have permissions to use any projects for the workspace. Please contact your
              administrator.
            </Header.Subheader>
          </Header>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderMissingCredentials() {
    // IMPORTANT: service catalog workspaces do not support external researchers. This code
    // is here to help make a decision if we keep it or remove it.
    return (
      <>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="key" />
            No AWS credentials
            <Header.Subheader>To manage research workspaces, click Configure AWS Credentials.</Header.Subheader>
          </Header>
          <div>
            <Button
              color="orange"
              size="medium"
              basic
              onClick={this.handleConfigureCredentials}
              style={{ maxWidth: '100%' }}
            >
              Configure AWS Credentials
            </Button>
          </div>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderButtons() {
    return (
      <div className="mt3">
        <Button
          floated="right"
          icon="right arrow"
          labelPosition="right"
          className="ml2"
          primary
          content="Next"
          disabled
        />
        <Button
          floated="right"
          icon="left arrow"
          labelPosition="left"
          className="ml2"
          content="Previous"
          onClick={this.handlePrevious}
        />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentSetup, {
  handleSelectEnvType: action,
  handlePrevious: action,
  handleCompleted: action,
  setOnboarding: action,
  studyIds: computed,
  userStore: computed,
  envTypesStore: computed,
  clientInformationStore: computed,
  currentStep: computed,
  selectedTypeId: observable,
  onboardingOpen: observable,
});

export default inject('userStore', 'envTypesStore', 'clientInformationStore')(withRouter(observer(ScEnvironmentSetup)));
