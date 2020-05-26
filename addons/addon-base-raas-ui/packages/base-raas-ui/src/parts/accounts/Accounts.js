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
import AwsAccountsList from './AwsAccountsList';
import IndexesList from './IndexesList';
import ProjectsList from '../projects/ProjectsList';

const panes = [
  { menuItem: 'Projects', render: () => <ProjectsList /> },
  { menuItem: 'Indexes', render: () => <IndexesList /> },
  { menuItem: 'AWS Accounts', render: () => <AwsAccountsList /> },
];

// eslint-disable-next-line react/prefer-stateless-function
class Accounts extends React.Component {
  render() {
    return (
      <Container className="mt3 animated fadeIn">
        <Segment basic className="p0">
          <Tab panes={panes} />
        </Segment>
      </Container>
    );
  }
}

export default inject('userRolesStore', 'indexesStore', 'awsAccountsStore')(withRouter(observer(Accounts)));
