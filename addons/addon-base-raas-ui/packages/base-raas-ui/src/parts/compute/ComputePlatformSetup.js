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
import { Icon, Header, Segment, Button } from 'semantic-ui-react';
import { isStoreLoading, isStoreError, isStoreEmpty } from '@amzn/base-ui/dist/models/BaseStore';
import { swallowError } from '@amzn/base-ui/dist/helpers/utils';
import BasicProgressPlaceholder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';

import UserOnboarding from '../users/UserOnboarding';
import SelectComputePlatformStep from './SelectComputePlatformStep';
import ConfigureComputePlatformStep from './ConfigureComputePlatformStep';

// expected props
// - onPrevious (via props)
// - onCompleted (via props) a function is called after a call to create an environment is performed
// - studyIds (via props) (optional) an array of the selected study ids
// - currentStep (via props) an instance of the CurrentStep model
// - computePlatformsStore (via injection)
// - clientInformationStore (via injection)
class ComputePlatformSetup extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.selectedPlatformId = undefined;
      this.onboardingOpen = false;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    swallowError(this.computePlatformsStore.load());
  }

  get userStore() {
    return this.props.userStore;
  }

  get computePlatformsStore() {
    return this.props.computePlatformsStore;
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

  handleSelectComputePlatform = async platformId => {
    this.selectedPlatformId = platformId;
    const platformsStore = this.computePlatformsStore;
    if (!platformsStore) return;

    // We start the loading of the configurations for the selected platform
    const platformStore = platformsStore.getComputePlatformStore(platformId);
    await platformStore.load();

    // We also try to figure out the ip address and if there is an error,
    // then that is okay, we show an empty string for the cidr field
    const clientInformationStore = this.clientInformationStore;
    try {
      await clientInformationStore.load();
    } catch (error) {
      // ignore intentionally
    }

    window.scrollTo(0, 0);
    runInAction(() => {
      this.currentStep.setStep('selectComputeConfiguration');
    });
  };

  handlePrevious = () => {
    const currentStep = this.currentStep;
    if (currentStep.step === 'selectComputePlatform') {
      this.props.onPrevious();
      return;
    }

    this.currentStep.setStep('selectComputePlatform');
  };

  handleCompleted = async environment => {
    return this.props.onCompleted(environment);
  };

  get studyIds() {
    return this.props.studyIds;
  }

  render() {
    const store = this.computePlatformsStore;
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
    const platformId = this.selectedPlatformId;
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
    if (isExternalResearcher && !hasCredentials) {
      return this.renderMissingCredentials();
    }

    if (step === 'selectComputePlatform') {
      content = (
        <SelectComputePlatformStep onPrevious={this.handlePrevious} onNext={this.handleSelectComputePlatform} />
      );
    } else if (step === 'selectComputeConfiguration') {
      content = (
        <ConfigureComputePlatformStep
          platformId={platformId}
          studyIds={studyIds}
          onPrevious={this.handlePrevious}
          onCompleted={this.handleCompleted}
        />
      );
    }

    return content;
  }

  renderLoadingError() {
    const store = this.computePlatformsStore;
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
            No compute platform
            <Header.Subheader>
              There are no compute platform to choose from. Your role might be restricted. Please contact your
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
              You currently do not have permissions to use any projects for the workspace. please contact your
              administrator.
            </Header.Subheader>
          </Header>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderMissingCredentials() {
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
decorate(ComputePlatformSetup, {
  handleSelectComputePlatform: action,
  handlePrevious: action,
  handleCompleted: action,
  setOnboarding: action,
  studyIds: computed,
  userStore: computed,
  computePlatformsStore: computed,
  clientInformationStore: computed,
  currentStep: computed,
  selectedPlatformId: observable,
  onboardingOpen: observable,
});

export default inject('userStore', 'computePlatformsStore', 'clientInformationStore')(observer(ComputePlatformSetup));
