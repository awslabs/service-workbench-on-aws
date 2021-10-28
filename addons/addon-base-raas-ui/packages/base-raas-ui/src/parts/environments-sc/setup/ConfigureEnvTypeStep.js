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

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreEmpty, isStoreError, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import CreateInternalEnvForm from './CreateInternalEnvForm';

// expected props
// - onPrevious (via props)
// - onCompleted (via props) a function is called after a call to create a workspace is performed
// - envTypeId (via props)
// - studyIds (via props)
// - envTypesStore (via injection)
// - clientInformationStore (via injection)
// - userStore (via injection)
// - scEnvironmentsStore (via injection)
class ConfigureEnvTypeStep extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);

    swallowError(this.envTypeConfigsStore.load());
  }

  get envTypeId() {
    return this.props.envTypeId;
  }

  get envTypeTitle() {
    return _.get(this.envTypesStore.getEnvType(this.envTypeId), 'name');
  }

  get userStore() {
    return this.props.userStore;
  }

  get clientInformationStore() {
    return this.props.clientInformationStore;
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }

  get scEnvironmentsStore() {
    return this.props.scEnvironmentsStore;
  }

  get envTypeConfigsStore() {
    return this.envTypesStore.getEnvTypeConfigsStore(this.envTypeId);
  }

  get configurations() {
    return this.envTypeConfigsStore.list;
  }

  get defaultCidr() {
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
    const store = this.scEnvironmentsStore;
    const environment = await store.createScEnvironment({ ...data, studyIds });
    return this.props.onCompleted(environment);
  };

  render() {
    const store = this.envTypeConfigsStore;
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

    return content;
  }

  renderLoadingError() {
    const store = this.envTypeConfigsStore;
    return (
      <>
        <ErrorBox error={store.error} className="p0 mt2 mb3" />
        {this.renderButtons()}
      </>
    );
  }

  renderContent() {
    const envTypeId = this.envTypeId;
    const configurations = this.configurations;
    const title = this.envTypeTitle;
    const defaultCidr = this.defaultCidr;
    const isExternal = this.userStore.user.isExternalUser;

    return (
      <div className="mt2 animated fadeIn">
        {!isExternal && (
          <CreateInternalEnvForm
            envTypeId={envTypeId}
            configurations={configurations}
            title={title}
            defaultCidr={defaultCidr}
            onPrevious={this.handlePrevious}
            onNext={this.handleCreate}
          />
        )}
        {isExternal && this.renderExternalNotSupported()}
        {/* {isExternal && (
          <CreateExternalEnvForm
            envTypeId={envTypeId}
            configurations={configurations}
            title={title}
            defaultCidr={defaultCidr}
            onPrevious={this.handlePrevious}
            onNext={this.handleCreate}
          />
        )} */}
      </div>
    );
  }

  renderExternalNotSupported() {
    return (
      <>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="server" />
            No support for external researchers
            <Header.Subheader>
              There are no workspace configurations to choose from. Your role is restricted. Please contact your
              administrator.
            </Header.Subheader>
          </Header>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderEmpty() {
    const title = this.envTypeTitle;
    return (
      <>
        <Header as="h3" textAlign="center" className="mt2">
          {title}
        </Header>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="server" />
            No workspace configurations
            <Header.Subheader>
              There are no workspace configurations to choose from. Your role might be restricted. Please contact your
              administrator.
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
decorate(ConfigureEnvTypeStep, {
  handlePrevious: action,
  handleCreate: action,
  userStore: computed,
  envTypesStore: computed,
  clientInformationStore: computed,
  envTypeId: computed,
  defaultCidr: computed,
  envTypeTitle: computed,
  scEnvironmentsStore: computed,
  configurations: computed,
  studyIds: computed,
});

export default inject(
  'userStore',
  'envTypesStore',
  'scEnvironmentsStore',
  'clientInformationStore',
)(observer(ConfigureEnvTypeStep));
