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
import { decorate, computed, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Icon, Header, Segment, Button } from 'semantic-ui-react';

import CreateInternalPlatformForm from './parts/CreateInternalPlatformForm';
import CreateExternalPlatformForm from './parts/CreateExternalPlatformForm';

// expected props
// - onPrevious (via props)
// - onCompleted (via props) a function is called after a call to create a workspace is performed
// - platformId (via props)
// - studyIds (via props)
// - computePlatformsStore (via injection)
// - clientInformationStore (via injection)
// - userStore (via injection)
// - environmentsStore (via injection)
class ConfigureComputePlatformStep extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
  }

  get platformId() {
    return this.props.platformId;
  }

  get platformTitle() {
    return _.get(this.computePlatformsStore.getComputePlatform(this.platformId), 'title');
  }

  get userStore() {
    return this.props.userStore;
  }

  get clientInformationStore() {
    return this.props.clientInformationStore;
  }

  get computePlatformsStore() {
    return this.props.computePlatformsStore;
  }

  get environmentsStore() {
    return this.props.environmentsStore;
  }

  get configurations() {
    const platform = this.computePlatformsStore.getComputePlatform(this.platformId);
    if (!platform) return [];
    return platform.configurationsList;
  }

  get defaultCidr() {
    // We pick the first one
    const value = _.get(_.first(this.configurations), 'defaultCidr');
    if (_.isUndefined(value)) return undefined; // This means that cidr should not be treated as an input
    if (!_.isEmpty(value)) return value;
    if (_.isEmpty(this.clientInformationStore.ipAddress)) return '';

    return `${this.clientInformationStore.ipAddress}/32`;
  }

  get studyIds() {
    return this.props.studyIds;
  }

  handlePrevious = () => {
    if (_.isFunction(this.props.onPrevious)) this.props.onPrevious();
  };

  // eslint-disable-next-line consistent-return
  handleCreate = async data => {
    const studyIds = this.studyIds || [];
    const store = this.environmentsStore;
    const environment = await store.createEnvironment({ ...data, studyIds });
    return this.props.onCompleted(environment);
  };

  render() {
    // Note: we assume that whatever component that is including this component, has
    // already loaded and verified that the computePlatformsStore has no errors
    const configurations = this.configurations;
    let content = null;

    if (_.isEmpty(configurations)) {
      content = this.renderEmpty();
    } else {
      content = this.renderContent();
    }

    return content;
  }

  renderContent() {
    const platformId = this.platformId;
    const configurations = this.configurations;
    const title = this.platformTitle;
    const defaultCidr = this.defaultCidr;
    const isExternal = this.userStore.user.isExternalUser;

    return (
      <div className="mt2 animated fadeIn">
        {!isExternal && (
          <CreateInternalPlatformForm
            platformId={platformId}
            configurations={configurations}
            title={title}
            defaultCidr={defaultCidr}
            onPrevious={this.handlePrevious}
            onNext={this.handleCreate}
          />
        )}
        {isExternal && (
          <CreateExternalPlatformForm
            platformId={platformId}
            configurations={configurations}
            title={title}
            defaultCidr={defaultCidr}
            onPrevious={this.handlePrevious}
            onNext={this.handleCreate}
          />
        )}
      </div>
    );
  }

  renderEmpty() {
    const title = this.platformTitle;
    return (
      <>
        <Header as="h3" textAlign="center" className="mt2">
          {title}
        </Header>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="server" />
            No compute platform configurations
            <Header.Subheader>
              There are no compute platform configurations to choose from. Your role might be restricted. Please contact
              your administrator.
            </Header.Subheader>
          </Header>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderButtons({ nextDisabled = true } = {}) {
    return (
      <div className="mt3">
        <Button floated="right" className="ml2" primary content="Create Research Workspace" disabled={nextDisabled} />
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
decorate(ConfigureComputePlatformStep, {
  handlePrevious: action,
  handleCreate: action,
  userStore: computed,
  computePlatformsStore: computed,
  clientInformationStore: computed,
  platformId: computed,
  defaultCidr: computed,
  platformTitle: computed,
  environmentsStore: computed,
  studyIds: computed,
});

export default inject(
  'userStore',
  'computePlatformsStore',
  'clientInformationStore',
  'environmentsStore',
)(observer(ConfigureComputePlatformStep));
