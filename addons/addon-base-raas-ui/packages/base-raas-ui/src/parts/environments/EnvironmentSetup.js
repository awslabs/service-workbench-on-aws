import React from 'react';
import { decorate, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Icon, Container, Header } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';

import { CurrentStep } from '../compute/helpers/CurrentStep';
import ComputePlatformSetup from '../compute/ComputePlatformSetup';
import SetupStepsProgress from './SetupStepsProgress';

// expected props
class EnvironmentSetup extends React.Component {
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
    this.goto('/workspaces');
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
    return <SetupStepsProgress currentStep={this.currentStep} />;
  }

  renderContent() {
    return (
      <ComputePlatformSetup
        currentStep={this.currentStep}
        onPrevious={this.handlePrevious}
        onCompleted={this.handleCompleted}
      />
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(EnvironmentSetup, {
  handlePrevious: action,
  handleCompleted: action,
  currentStep: observable,
});

export default inject()(withRouter(observer(EnvironmentSetup)));
