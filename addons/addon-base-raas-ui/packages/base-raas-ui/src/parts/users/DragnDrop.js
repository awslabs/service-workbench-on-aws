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
import React, { Component } from 'react';
import Dropzone from 'react-dropzone';
import { withRouter } from 'react-router-dom';
import { inject, observer } from 'mobx-react';
import { Segment, Icon, Header, Button, Message, Container } from 'semantic-ui-react';
import { decorate, observable, action, runInAction } from 'mobx';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';

import UserTable from './UserTable';

class DragnDrop extends Component {
  constructor() {
    super();
    this.state = {
      files: [],
      fileContent: '',
      jsonArrayContent: [],
    };
    runInAction(() => {
      this.formProcessing = false;
      this.validationErrors = new Map();
      this.user = {};
    });
  }

  csvJSON(csv) {
    const result = [];
    const lines = csv.split(/\r?\n/);
    const headers = lines[0].split(',');

    for (let i = 1; i < lines.length; i++) {
      const obj = {};
      const currentline = lines[i].split(',');
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentline[j];
      }
      result.push(obj);
    }

    return result;
  }

  onDrop = files => {
    const reader = new FileReader();
    reader.onabort = () => console.log('file reading was aborted');
    reader.onerror = () => console.log('file reading has failed');
    reader.onload = () => {
      const binaryStr = reader.result;
      const jsonArray = this.csvJSON(binaryStr);
      this.setState({ jsonArrayContent: jsonArray });
      this.setState({ fileContent: binaryStr });
    };
    files.forEach(file => reader.readAsText(file));
    this.setState({ files });
  };

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  renderButtons() {
    const processing = this.formProcessing;
    return (
      <div className="mt3">
        <Button floated="right" color="blue" icon disabled={processing} className="ml2" onClick={this.handleSubmit}>
          Submit
        </Button>
        <Button floated="right" disabled={processing} onClick={this.handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  async addAuthenticationProviderId(value) {
    const authStore = this.props.authenticationProviderConfigsStore;
    let authList = authStore.list;
    if (authList.length === 0) {
      await authStore.doLoad();
      authList = authStore.list;
    }
    let authId = null;
    _.forEach(authList, auth => {
      if (auth.config.title === _.find(this.props.identityProviderOption, { value }).text) {
        authId = auth.id;
      }
    });
    return authId;
  }

  async addAuthProviderId(userArr) {
    const promises = userArr.map(async user => {
      const authenticationProviderId = await this.addAuthenticationProviderId(user.identityProviderName);
      user.authenticationProviderId = authenticationProviderId;
      return user;
    });
    userArr = await Promise.all(promises);
    return userArr;
  }

  handleSubmit = action(async () => {
    this.formProcessing = true;
    try {
      // conmose the content to users and invoke add user
      const userArr = await this.addAuthProviderId(this.state.jsonArrayContent);
      await this.getStore().addUsers(userArr);
      runInAction(() => {
        this.formProcessing = false;
      });
      await this.getStore().load();
      this.goto('/users');
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(error);
    }
  });

  handleCancel = action(event => {
    event.preventDefault();
    event.stopPropagation();
    this.formProcessing = false;
    this.goto('/users');
  });

  getStore() {
    return this.props.usersStore;
  }

  renderTable() {
    let content;
    if (this.state.fileContent) {
      content = <UserTable userData={this.state.jsonArrayContent} />;
    } else {
      content = '';
    }
    return content;
  }

  render() {
    const files = this.state.files.map(file => (
      <li key={file.name}>
        {file.name} - {file.size} bytes
      </li>
    ));
    const maxSize = 512000;
    return (
      <div>
        <Container text>
          <Message info>
            <Message.Content>
              <Message.Header>CSV Example</Message.Header>
              <p>email,userRole,identityProviderName</p>
              <p>user1@datalake.amazonaws.com,researcher,DataLake</p>
              <p>user2@organization.onmicrosoft.com,researcher,AzureAD</p>
            </Message.Content>
          </Message>
        </Container>

        <Segment className="mt4 center">
          <Header as="h4" color="grey">
            Drag and drop files here
          </Header>
          <Dropzone onDrop={this.onDrop} minSize={0} maxSize={maxSize} multiple>
            {({ getRootProps, getInputProps, rejectedFiles }) => {
              const isFileTooLarge = rejectedFiles.length > 0 && rejectedFiles[0].size > maxSize;
              return (
                <div {...getRootProps()}>
                  <input {...getInputProps()} />
                  {<Icon name="cloud upload" size="massive" color="grey" />}
                  {isFileTooLarge && <div className="text-danger mt-2">File is too large.</div>}
                </div>
              );
            }}
          </Dropzone>
        </Segment>
        <aside>
          <h4>Files</h4>
          <ul>{files}</ul>
        </aside>
        {this.renderTable()}
        {this.renderButtons()}
      </div>
    );
  }
}
decorate(DragnDrop, {
  formProcessing: observable,
});

export default inject(
  'userStore',
  'usersStore',
  'userRolesStore',
  'authenticationProviderConfigsStore',
)(withRouter(observer(DragnDrop)));
