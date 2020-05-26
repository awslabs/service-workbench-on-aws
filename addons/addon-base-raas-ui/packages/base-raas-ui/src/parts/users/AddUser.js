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
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Header, Icon, Tab, Grid } from 'semantic-ui-react';

import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import { isStoreError, isStoreLoading, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import { toIdpOptions } from '../../models/forms/UserFormUtils';
import DragDrop from './DragDrop';
import AddSingleUser from './AddSingleUser';

// expected props
// - authenticationProviderConfigsStore (via injection)
class AddUser extends React.Component {
  componentDidMount() {
    swallowError(this.getStore().load());
  }

  render() {
    const store = this.getStore();
    let content = null;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0 mb3" />;
    } else if (isStoreLoading(store)) {
      content = <BasicProgressPlaceholder />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    }

    return (
      <Container className="mt3 mb4">
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="user" className="align-top" />
          <Header.Content className="left-align">Add User</Header.Content>
        </Header>
      </div>
    );
  }

  renderMain() {
    const identityProviderOptions = this.getIdentityProviderOptions();
    const panes = [
      {
        menuItem: 'Add Single User',
        render: () => (
          <Tab.Pane basic attached={false}>
            <div className="mt3 animated fadeIn">
              <AddSingleUser />
            </div>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Add Multiple Users',
        render: () => (
          <Tab.Pane basic attached={false}>
            <DragDrop identityProviderOptions={identityProviderOptions} />
          </Tab.Pane>
        ),
      },
    ];
    return (
      <Grid>
        <Grid.Column>
          <Tab defaultActiveIndex={0} className="mt2" menu={{ secondary: true, pointing: true }} panes={panes} />
        </Grid.Column>
      </Grid>
    );
  }

  getIdentityProviderOptions() {
    return toIdpOptions(this.getStore().list);
  }

  getStore() {
    return this.props.authenticationProviderConfigsStore;
  }
}

export default inject('authenticationProviderConfigsStore')(withRouter(observer(AddUser)));
