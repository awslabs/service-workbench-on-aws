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
import { decorate, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Icon, Container, Header } from 'semantic-ui-react';
import { gotoFn } from '@amzn/base-ui/dist/helpers/routing';
import { displaySuccess } from '@amzn/base-ui/dist/helpers/notification';

import { enableBuiltInWorkspaces } from '../../helpers/settings';
import { CurrentStep } from '../compute/helpers/CurrentStep';
import ComputePlatformSetup from '../compute/ComputePlatformSetup';
import SetupStepsProgress from '../environments-builtin/SetupStepsProgress';
import ScEnvironmentSetup from '../environments-sc/setup/ScEnvironmentSetup';

// expected props
class EnvironmentSetup extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      let step = 'selectEnvType';
      if (enableBuiltInWorkspaces) {
        step = 'selectComputePlatform';
      } else if (this.envTypeId) {
        step = 'selectEnvConfig'; // If envTypeId id is passed then jump to env config step
      }
      this.currentStep = CurrentStep.create({ step });
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
  }

  goto(pathname) {
    const goto = gotoFn(this);
    goto(pathname);
  }

  handlePrevious = () => {
    if (this.envTypeId) {
      // If envTypeId is already preselected selected
      // then we must have reached here via env type management page so go back to that page
      this.goto('/workspace-types-management');
    } else {
      this.goto('/workspaces');
    }
  };

  // eslint-disable-next-line no-unused-vars
  handleCompleted = async environment => {
    displaySuccess('The research workspace is being provisioned');
    this.goto('/workspaces');
  };

  render() {
    return (
      <Container className="mt3">
        {this.renderTitle()}
        {this.renderStepsProgress()}
        {this.renderContent()}
      </Container>
    );
  }

  renderTitle() {
    return (
      <div className="flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="server" className="align-top" />
          <Header.Content className="left-align">Research Workspaces</Header.Content>
        </Header>
      </div>
    );
  }

  renderStepsProgress() {
    return <SetupStepsProgress currentStep={this.currentStep} envTypeImmutable={!!this.envTypeId} />;
  }

  renderContent() {
    let content = null;
    if (enableBuiltInWorkspaces) {
      content = (
        <ComputePlatformSetup
          currentStep={this.currentStep}
          onPrevious={this.handlePrevious}
          onCompleted={this.handleCompleted}
        />
      );
    } else {
      content = (
        <ScEnvironmentSetup
          currentStep={this.currentStep}
          onPrevious={this.handlePrevious}
          onCompleted={this.handleCompleted}
          envTypeId={this.envTypeId}
          envTypeImmutable={!!this.envTypeId} // If envTypeId is passed already then do not allow selecting it
        />
      );
    }

    return content;
  }

  get envTypeId() {
    return (this.props.match.params || {}).envTypeId;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(EnvironmentSetup, {
  handlePrevious: action,
  handleCompleted: action,
  currentStep: observable,
});

export default inject()(withRouter(observer(EnvironmentSetup)));
