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
import { Tab, Segment, Container } from 'semantic-ui-react';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import RolesList from './RolesList';
import UsersList from './UsersList';

const panes = [
  { menuItem: 'Users', render: () => <UsersList /> },
  { menuItem: 'Roles', render: () => <RolesList /> },
];

// eslint-disable-next-line react/prefer-stateless-function
class User extends React.Component {
  render() {
    if (!this.props.userStore.cloneUser.isAdmin) {
      this.props.history.push('/');
    }
    return (
      <Container className="mt3 animated fadeIn">
        <Segment basic className="p0">
          <Tab panes={panes} data-testid="users-table" />
        </Segment>
      </Container>
    );
  }
}

export default inject('userStore')(withRouter(observer(User)));
