import React from 'react';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { decorate, observable, action, runInAction } from 'mobx';
import { Button, Header, Container, Message } from 'semantic-ui-react';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import Input from '@aws-ee/base-ui/dist/parts/helpers/fields/Input';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';

import { getAddUserApplicationForm } from '../models/forms/AddUserApplicationForm';

class UserApplication extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};

    runInAction(() => {
      this.logoutProcessing = false;
      this.currentUser = props.userStore.cloneUser;
    });
    this.form = getAddUserApplicationForm();
    this.form.$('email').value = this.currentUser.username;
  }

  handleLogout = action(async event => {
    this.logoutProcessing = true;
    event.preventDefault();
    event.stopPropagation();

    try {
      await this.props.authentication.logout();
      runInAction(() => {
        this.logoutProcessing = false;
      });
    } catch (error) {
      displayError(error);
      runInAction(() => {
        this.logoutProcessing = false;
      });
    }
  });

  render() {
    let content = null;
    if (this.currentUser.status === 'pending') {
      content = this.renderFormSubmittedMessage();
    } else {
      content = this.renderAddUserPage();
    }
    return content;
  }

  renderAddUserPage() {
    return (
      <Container className="pt4">
        <div className="mt2 animated fadeIn">
          <Header as="h2" icon textAlign="center" className="mt3" color="grey">
            Research Portal Application
          </Header>
          <div className="mt3 ml3 mr3 animated fadeIn">{this.renderAddUserForm()}</div>
        </div>
      </Container>
    );
  }

  renderFormSubmittedMessage() {
    const processing = this.logoutProcessing;
    return (
      <Container text className="pt4">
        <Message icon>
          <Message.Content>
            <Message.Header>We have received your application</Message.Header>
            You will not have access to the portal until an administrator reviews and approves your application.
            <div className="mt2">
              We recommend you logout and login when you have received access.
              <Button
                floated="right"
                color="blue"
                icon
                disabled={processing}
                className="ml2"
                onClick={this.handleLogout}
              >
                Logout
              </Button>
            </div>
          </Message.Content>
        </Message>
      </Container>
    );
  }

  renderAddUserForm() {
    const form = this.form;

    return (
      <Form form={form} onSuccess={this.handleSubmit}>
        {({ processing }) => (
          <>
            <Input field={form.$('email')} disabled className="mt3 mb4" />
            <Input field={form.$('firstName')} className="mt3 mb4" />
            <Input field={form.$('lastName')} />
            <TextArea field={form.$('applyReason')} />

            <Button className="ml2 mb3" floated="right" color="blue" icon disabled={processing} type="submit">
              Submit Application
            </Button>
          </>
        )}
      </Form>
    );
  }

  handleSubmit = async form => {
    try {
      const user = form.values();

      this.currentUser.firstName = user.firstName;
      this.currentUser.lastName = user.lastName;
      this.currentUser.applyReason = user.applyReason;
      this.currentUser.status = 'pending';
      const updatedUser = await this.getStore().updateUserApplication(this.currentUser);
      runInAction(() => {
        this.currentUser.status = updatedUser.status;
      });
    } catch (error) {
      displayError(error);
    }
  };

  getStore() {
    return this.props.usersStore;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(UserApplication, {
  logoutProcessing: observable,
  currentUser: observable,
});

export default inject(
  'userStore',
  'usersStore',
  'userRolesStore',
  'awsAccountsStore',
  'indexesStore',
  'authentication',
)(withRouter(observer(UserApplication)));
