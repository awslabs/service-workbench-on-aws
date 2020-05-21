import React from 'react';
import { observer, inject } from 'mobx-react';
import { action, computed, decorate } from 'mobx';

class EnvironmentConnectButton extends React.Component {
  getUrl = async environment => {
    switch (environment.instanceInfo.type) {
      case 'sagemaker': {
        const { AuthorizedUrl } = await environment.getEnvironmentNotebookUrl(this.user);
        return `${AuthorizedUrl}&view=lab`;
      }
      case 'emr':
        return environment.instanceInfo.JupyterUrl;
      default:
        return '';
    }
  };

  handleConnectClick = async event => {
    event.preventDefault();
    event.stopPropagation();
    const newTab = window.open('about:blank', '_blank');

    const environment = this.props.environment;

    const url = await this.getUrl(environment);
    // Change to the notebook
    newTab.location = url;
    environment.setFetchingUrl(false);
  };

  render() {
    const { as: As, userStore, user, environment, ...props } = this.props;
    return <As onClick={this.handleConnectClick} {...props} />;
  }

  get user() {
    return this.props.user || this.props.userStore.user;
  }
}
// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(EnvironmentConnectButton, {
  user: computed,
  handleConnectClick: action,
  getUrl: action,
});

export default inject('userStore')(observer(EnvironmentConnectButton));
