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
