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
