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
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Icon, Container, Header, Segment, Button } from 'semantic-ui-react';
import { gotoFn } from '@amzn/base-ui/dist/helpers/routing';
import { displaySuccess } from '@amzn/base-ui/dist/helpers/notification';

import { enableBuiltInWorkspaces } from '../../helpers/settings';
import { CurrentStep } from '../compute/helpers/CurrentStep';
import ComputePlatformSetup from '../compute/ComputePlatformSetup';
import StudyStepsProgress from './StudyStepsProgress';
import ScEnvironmentSetup from '../environments-sc/setup/ScEnvironmentSetup';

// expected props
// - filesSelection (via injection)
class StudyEnvironmentSetup extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      const step = enableBuiltInWorkspaces
        ? 'selectComputePlatform'
        : this.envTypeId
        ? 'selectEnvConfig' // If envTypeId id is passed then jump to env config step
        : 'selectEnvType';
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
      this.goto(`/studies/workspace-type/${encodeURIComponent(this.envTypeId)}`);
    } else {
      this.goto('/studies');
    }
  };

  // eslint-disable-next-line no-unused-vars
  handleCompleted = async environment => {
    this.props.filesSelection.cleanup();
    displaySuccess('The research workspace is being provisioned');
    this.goto('/workspaces');
  };

  get studyIds() {
    return this.props.filesSelection.fileNames; // TODO - yes this is confusing, we should refactor the filesSelection to studiesSelection
  }

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
          <Icon name="book" className="align-top" />
          <Header.Content className="left-align">Studies</Header.Content>
        </Header>
      </div>
    );
  }

  renderStepsProgress() {
    return <StudyStepsProgress currentStep={this.currentStep} envTypeImmutable={!!this.envTypeId} />;
  }

  renderContent() {
    const studyIds = this.studyIds;

    if (_.isEmpty(studyIds)) {
      return this.renderEmpty();
    }

    let content = null;
    if (enableBuiltInWorkspaces) {
      content = (
        <ComputePlatformSetup
          currentStep={this.currentStep}
          studyIds={this.studyIds}
          onPrevious={this.handlePrevious}
          onCompleted={this.handleCompleted}
        />
      );
    } else {
      content = (
        <ScEnvironmentSetup
          currentStep={this.currentStep}
          studyIds={this.studyIds}
          onPrevious={this.handlePrevious}
          onCompleted={this.handleCompleted}
          envTypeId={this.envTypeId}
          envTypeImmutable={!!this.envTypeId} // If envTypeId is passed already then do not allow selecting it
        />
      );
    }

    return content;
  }

  renderEmpty() {
    return (
      <>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="clipboard outline" />
            No studies selected
            <Header.Subheader>
              Before you can create a workspace, you need to select one or more studies.
            </Header.Subheader>
          </Header>
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

  get envTypeId() {
    return (this.props.match.params || {}).envTypeId;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(StudyEnvironmentSetup, {
  handlePrevious: action,
  handleCompleted: action,
  studyIds: computed,
  currentStep: observable,
});

export default inject('filesSelection')(withRouter(observer(StudyEnvironmentSetup)));
