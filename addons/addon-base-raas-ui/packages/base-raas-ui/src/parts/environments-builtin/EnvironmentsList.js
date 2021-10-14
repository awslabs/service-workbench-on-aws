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
import { decorate, action, observable, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Icon, Segment, Container, Label, Button } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { storage, swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreLoading, isStoreEmpty, isStoreNotEmpty, isStoreError } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import EnvironmentCard from './EnvironmentCard';
import UserOnboarding from '../users/UserOnboarding';
import UserPinModal from '../users/UserPinModal';
import localStorageKeys from '../../models/constants/local-storage-keys';

// expected props
// - environmentsStore (via injection)
// - location (from react router)
class EnvironmentsList extends React.Component {
  constructor(props) {
    super(props);
    const user = this.getUserStore().user;

    runInAction(() => {
      this.user = user;
      this.onboardingOpen = false;
      this.pinModalOpen = user.isExternalUser && _.isEmpty(storage.getItem(localStorageKeys.pinToken));
    });
  }

  componentDidMount() {
    swallowError(this.getEnvironmentsStore().load());
    this.getEnvironmentsStore().startHeartbeat();
  }

  componentWillUnmount() {
    this.getEnvironmentsStore().stopHeartbeat();
  }

  getEnvironmentsStore() {
    return this.props.environmentsStore;
  }

  getUserStore() {
    return this.props.userStore;
  }

  setOnboarding = value => {
    this.onboardingOpen = value;
  };

  hidePinModal = () => {
    this.pinModalOpen = false;
  };

  handleDetailClick = event => {
    event.preventDefault();
    event.stopPropagation();

    // see https://reactjs.org/docs/events.html and https://github.com/facebook/react/issues/5733
    const instanceId = event.currentTarget.dataset.instance;
    const goto = gotoFn(this);
    goto(`/workspaces/id/${instanceId}`);
  };

  handleCreateEnvironment = event => {
    event.preventDefault();
    event.stopPropagation();

    const goto = gotoFn(this);
    goto(`/workspaces/create`);
  };

  handleConfigureCredentials = event => {
    event.preventDefault();
    event.stopPropagation();
    this.setOnboarding(true);
  };

  needsAWSCredentials = () => this.user.isExternalResearcher && !this.user.hasCredentials;

  render() {
    const store = this.getEnvironmentsStore();
    let content = null;

    if (this.needsAWSCredentials()) {
      content = this.renderConfigureAWS();
    } else if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={3} />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3 animated fadeIn">
        {this.renderTitle()}
        {content}
        {this.onboardingOpen && <UserOnboarding onclose={() => this.setOnboarding(false)} />}
      </Container>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="clipboard outline" />
          No research workspaces
          <Header.Subheader>To create a research workspace, click Create Research Workspace.</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderConfigureAWS() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="key" />
          No AWS credentials
          <Header.Subheader>To manage research workspaces, click Configure AWS Credentials.</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="server" className="align-top" />
          <Header.Content className="left-align">Research Workspaces {this.renderTotal()}</Header.Content>
        </Header>
        {this.needsAWSCredentials() ? (
          <Button color="orange" size="medium" basic onClick={this.handleConfigureCredentials}>
            Configure AWS Credentials
          </Button>
        ) : (
          <Button color="blue" size="medium" basic onClick={this.handleCreateEnvironment}>
            Create Research Workspace
          </Button>
        )}
      </div>
    );
  }

  renderTotal() {
    const store = this.getEnvironmentsStore();
    if (isStoreError(store) || isStoreLoading(store)) return null;

    return <Label circular>{store.total}</Label>;
  }

  renderMain() {
    const store = this.getEnvironmentsStore();
    const list = store.list;

    return (
      <div>
        <UserPinModal
          show={this.pinModalOpen}
          hideModal={this.hidePinModal}
          user={this.user}
          message="PIN is required to get previously created stack information"
        />
        {_.map(list, item => (
          <Segment
            className="p3 mb2 cursor-pointer"
            clearing
            key={item.id}
            data-instance={item.id}
            onClick={this.handleDetailClick}
          >
            <EnvironmentCard environment={item} environmentsStore={this.getEnvironmentsStore()} user={this.user} />
          </Segment>
        ))}
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(EnvironmentsList, {
  handleDetailClick: action,
  setOnboarding: action,
  hidePinModal: action,
  user: observable,
  onboardingOpen: observable,
  pinModalOpen: observable,
});

export default inject('environmentsStore', 'userStore')(withRouter(observer(EnvironmentsList)));
