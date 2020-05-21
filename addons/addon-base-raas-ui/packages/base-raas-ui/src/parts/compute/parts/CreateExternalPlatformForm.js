import _ from 'lodash';
import React from 'react';
import { decorate, computed, runInAction, observable, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Segment, Button, Header } from 'semantic-ui-react';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { awsRegion } from '@aws-ee/base-ui/dist/helpers/settings';

import { getCreateExternalPlatformForm } from '../../../models/forms/CreateExternalPlatformForm';
import SelectConfigurationCards from './SelectConfigurationCards';

// expected props
// - onPrevious (via props)
// - onNext (via props) a function is called with the form data
// - platformId (via props)
// - configurations (via props)
// - title (via props)
// - defaultCidr (via props)
// - clientInformationStore (via injection)
// - userStore (via injection)
// - usersStore (via injection)
class CreateExternalPlatformForm extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.askForCredentials = !this.userStore.user.hasCredentials;
      this.form = getCreateExternalPlatformForm({
        askForCredentials: this.askForCredentials,
        cidr: this.props.defaultCidr,
      });
    });
  }

  get platformId() {
    return this.props.platformId;
  }

  get configurations() {
    return this.props.configurations;
  }

  get userStore() {
    return this.props.userStore;
  }

  get usersStore() {
    return this.props.usersStore;
  }

  // eslint-disable-next-line consistent-return
  handlePrevious = () => {
    if (_.isFunction(this.props.onPrevious)) return this.props.onPrevious();
  };

  // eslint-disable-next-line consistent-return
  handleNext = async form => {
    const data = { ...form.values(), params: {}, platformId: this.platformId };

    // We pick the mutable parameters and put them in params object
    const configuration = _.find(this.configurations, ['id', data.configurationId]);
    _.forEach(_.keys(configuration.mutableParams), key => {
      if (!_.has(data, key)) return;
      data.params[key] = data[key];
      delete data[key];
    });

    // Next, we need to encrypt the credentials if they are provided
    const askForCredentials = this.askForCredentials;
    const user = this.userStore.user;
    const props = ['accessKeyId', 'secretAccessKey'];

    try {
      if (askForCredentials) {
        const credentials = _.pick(data, props);
        credentials.region = awsRegion;
        const usersStore = this.usersStore;
        await user.setEncryptedCreds(credentials, data.pin);
        await usersStore.updateUser(user);
      }

      // We remove any access key information from data
      // but we keep pin in data, and the environment store will remove it
      const adjustedData = _.omit(data, props);

      await this.props.onNext(adjustedData);
    } catch (error) {
      displayError(error);
    }
  };

  handleForgotPin = event => {
    event.preventDefault();
    event.stopPropagation();

    const form = this.form;
    const addRequired = field => {
      const rules = field.rules;
      if (_.startsWith('required')) return;
      field.set('rules', `required|${rules}`);
    };

    addRequired(form.$('accessKeyId'));
    addRequired(form.$('secretAccessKey'));
    this.askForCredentials = true;
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
    const askForCredentials = this.askForCredentials;

    return (
      <Segment clearing className="p3 mb3">
        <Form form={form} onCancel={this.handlePrevious} onSuccess={this.handleNext}>
          {({ processing, /* onSubmit, */ onCancel }) => (
            <>
              <Input field={form.$('name')} />
              {askForCidr && <Input field={form.$('cidr')} />}
              <SelectConfigurationCards configurations={configurations} formField={form.$('configurationId')} />
              <TextArea field={form.$('description')} />
              {askForCredentials && (
                <>
                  <Input field={form.$('accessKeyId')} />
                  <Input field={form.$('secretAccessKey')} type="password" />
                </>
              )}
              <Input field={form.$('pin')} type="password" icon="lock" iconPosition="left" />

              {!askForCredentials && (
                <Button floated="left" disabled={processing} onClick={this.handleForgotPin}>
                  Forgot PIN?
                </Button>
              )}

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
decorate(CreateExternalPlatformForm, {
  form: observable,
  platformId: computed,
  askForCredentials: observable,
  configurations: computed,
  userStore: computed,
  usersStore: computed,
  handlePrevious: action,
  handleForgotPin: action,
});

export default inject('userStore', 'usersStore', 'clientInformationStore')(observer(CreateExternalPlatformForm));
