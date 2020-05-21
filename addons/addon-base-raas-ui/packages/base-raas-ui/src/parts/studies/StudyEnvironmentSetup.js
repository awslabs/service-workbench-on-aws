import _ from 'lodash';
import React from 'react';
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Icon, Container, Header, Segment, Button } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';

import { CurrentStep } from '../compute/helpers/CurrentStep';
import ComputePlatformSetup from '../compute/ComputePlatformSetup';
import StudyStepsProgress from './StudyStepsProgress';

// expected props
// - filesSelection (via injection)
class StudyEnvironmentSetup extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.currentStep = CurrentStep.create({ step: 'selectComputePlatform' });
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
    this.goto('/studies');
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
    return <StudyStepsProgress currentStep={this.currentStep} />;
  }

  renderContent() {
    const studyIds = this.studyIds;

    if (_.isEmpty(studyIds)) {
      return this.renderEmpty();
    }

    return (
      <ComputePlatformSetup
        currentStep={this.currentStep}
        studyIds={this.studyIds}
        onPrevious={this.handlePrevious}
        onCompleted={this.handleCompleted}
      />
    );
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
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(StudyEnvironmentSetup, {
  handlePrevious: action,
  handleCompleted: action,
  studyIds: computed,
  currentStep: observable,
});

export default inject('filesSelection')(withRouter(observer(StudyEnvironmentSetup)));
