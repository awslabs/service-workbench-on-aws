import _ from 'lodash';
import React from 'react';
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Segment, Button, Header } from 'semantic-ui-react';
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
class CreateInternalEnvForm extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.form = getCreateInternalEnvForm({
        projectIdOptions: this.projectIdOptions,
        cidr: this.props.defaultCidr,
      });
    });
  }

  get projectIdOptions() {
    const store = this.userStore;
    return store.projectIdDropdown;
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

  renderForm() {
    const form = this.form;
    const askForCidr = !_.isUndefined(this.props.defaultCidr);
    const configurations = this.configurations;

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
  projectIdOptions: computed,
  handlePrevious: action,
});

export default inject('userStore', 'clientInformationStore')(observer(CreateInternalEnvForm));
