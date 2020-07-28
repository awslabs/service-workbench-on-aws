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
import DevGuide from './DevGuide';
import GettingStarted from './GettingStarted';
import FaqSection from './FaqSection';

const panes = [
  { menuItem: 'Getting Started', render: () => <GettingStarted /> },
  { menuItem: 'FAQ', render: () => <FaqSection /> },
  { menuItem: 'Developer Guide', render: () => <DevGuide /> },
];

// eslint-disable-next-line react/prefer-stateless-function
class SupportPage extends React.Component {
  render() {
    return (
      <Container className="mt3 animated fadeIn">
        <Segment basic className="p0">
          <Tab menu={{ fluid: true, tabular: true }} panes={panes} />
        </Segment>
      </Container>
    );
  }
}

export default inject('userRolesStore', 'indexesStore', 'awsAccountsStore')(withRouter(observer(SupportPage)));
