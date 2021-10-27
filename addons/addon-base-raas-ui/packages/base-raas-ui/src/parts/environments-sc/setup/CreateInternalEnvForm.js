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
import { Segment, Button, Header, Icon } from 'semantic-ui-react';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import Dropdown from '@aws-ee/base-ui/dist/parts/helpers/fields/DropDown';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';

import { getCreateInternalEnvForm } from '../../../models/forms/CreateInternalEnvForm';
import SelectConfigurationCards from './SelectConfigurationCards';

// expected props
// - onPrevious (via props)
// - onNext (via props) a function is called with the form data
// - envTypeId (via props)
// - configurations (via props)
// - title (via props)
// - defaultCidr (via props)
// - clientInformationStore (via injection)
// - userStore (via injection)
// - projectsStore (via injection)
class CreateInternalEnvForm extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = getCreateInternalEnvForm({
        projectIdOptions: this.getProjectIdOptions(),
        cidr: this.isAppStreamEnabled ? undefined : this.props.defaultCidr,
      });
    });
  }

  // The list of projects assigned to the user might be broader than the
  // list of projects actually available for environment provisioning
  // For example: Projects not fully configured with AppStream need to be filtered out
  getProjectIdOptions() {
    const store = this.userStore;
    if (!this.isAppStreamEnabled) return store.projectIdDropdown;

    const projects = this.getProjects();
    const filteredProjects = _.filter(projects, proj => proj.isAppStreamConfigured);
    if (_.isEmpty(filteredProjects)) return [];

    const filteredProjectIds = _.map(filteredProjects, proj => proj.id);
    const retVal = _.filter(store.projectIdDropdown, proj => _.includes(filteredProjectIds, proj.key));

    return retVal;
  }

  get isAppStreamEnabled() {
    return process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true';
  }

  get envTypeId() {
    return this.props.envTypeId;
  }

  get configurations() {
    return this.props.configurations;
  }

  get userStore() {
    return this.props.userStore;
  }

  getProjects() {
    const store = this.getProjectsStore();
    return store.list;
  }

  getProjectsStore() {
    const store = this.props.projectsStore;
    store.load();
    return store;
  }

  // eslint-disable-next-line consistent-return
  handlePrevious = () => {
    if (_.isFunction(this.props.onPrevious)) return this.props.onPrevious();
  };

  // eslint-disable-next-line consistent-return
  handleNext = async form => {
    const data = { ...form.values(), envTypeId: this.envTypeId };

    try {
      await this.props.onNext(data);
    } catch (error) {
      displayError(error);
    }
  };

  render() {
    const title = this.props.title || '';
    return (
      <div className="mt2">
        <Header as="h3" textAlign="center">
          {title}
        </Header>
        {this.renderForm()}
      </div>
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

  renderMissingAppStreamConfig() {
    return (
      <>
        <Segment placeholder className="mt2">
          <Header icon className="color-grey">
            <Icon name="lock" />
            Missing association with AppStream projects
            <Header.Subheader>
              Your projects are not associated to an AppStream-configured account. Please contact your administrator.
            </Header.Subheader>
          </Header>
        </Segment>
        {this.renderButtons()}
      </>
    );
  }

  renderForm() {
    const form = this.form;
    const askForCidr = !_.isUndefined(this.props.defaultCidr) && !this.isAppStreamEnabled;
    const configurations = this.configurations;

    // we show the AppStream configuration warning when the feature is enabled,
    // and the user's projects are not linked to AppStream-configured accounts
    const projects = this.getProjectIdOptions();
    if (this.isAppStreamEnabled && _.isEmpty(projects)) {
      return this.renderMissingAppStreamConfig();
    }

    return (
      <Segment clearing className="p3 mb3">
        <Form form={form} onCancel={this.handlePrevious} onSuccess={this.handleNext}>
          {({ processing, /* onSubmit, */ onCancel }) => (
            <>
              <Input dataTestId="workspace-name" field={form.$('name')} />
              {askForCidr && <Input field={form.$('cidr')} />}
              <Dropdown dataTestId="project-id" field={form.$('projectId')} fluid selection />
              <SelectConfigurationCards configurations={configurations} formField={form.$('envTypeConfigId')} />
              <TextArea dataTestId="description-text-area" field={form.$('description')} />

              <Button
                floated="right"
                className="ml2"
                primary
                content="Create Research Workspace"
                disabled={processing}
                type="submit"
              />

              <Button
                floated="right"
                icon="left arrow"
                labelPosition="left"
                className="ml2"
                content="Previous"
                disabled={processing}
                onClick={onCancel}
              />
            </>
          )}
        </Form>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(CreateInternalEnvForm, {
  form: observable,
  envTypeId: computed,
  configurations: computed,
  userStore: computed,
  isAppStreamEnabled: computed,
  handlePrevious: action,
});

export default inject('userStore', 'projectsStore', 'clientInformationStore')(observer(CreateInternalEnvForm));
