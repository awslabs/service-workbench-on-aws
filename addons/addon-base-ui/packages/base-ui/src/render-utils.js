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
import ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';
import { BrowserRouter } from 'react-router-dom';
import { Message, Icon, Container } from 'semantic-ui-react';

// Render the AppContainer component which will then ask plugins to provide the App component
function renderAppContainer(AppContainer, appContext) {
  ReactDOM.render(
    <Provider {...appContext}>
      <BrowserRouter>
        <AppContainer />
      </BrowserRouter>
    </Provider>,
    document.getElementById('root'),
  );
}

// Render a progress message
function renderProgress(
  progressContent = (
    <Message.Content>
      <Message.Header>Just one second</Message.Header>
      Great things are now happening, please wait!
    </Message.Content>
  ),
) {
  ReactDOM.render(
    <Container text className="pt4">
      <Message icon>
        <Icon name="circle notched" loading />
        {progressContent}
      </Message>
    </Container>,
    document.getElementById('root'),
  );
}

// Render an error message
function renderError(err) {
  const error = _.get(err, 'message', 'Unknown error');
  ReactDOM.render(
    <Container text className="pt4">
      <Message negative>
        <Message.Header>We have a problem</Message.Header>
        <p>{error}</p>
        <p>See if refreshing the browser will resolve your issue</p>
      </Message>
    </Container>,
    document.getElementById('root'),
  );
}

export { renderAppContainer, renderProgress, renderError };
