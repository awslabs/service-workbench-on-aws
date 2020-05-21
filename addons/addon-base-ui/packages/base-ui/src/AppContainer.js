import React, { Component } from 'react';
import _ from 'lodash';
import { withRouter } from 'react-router-dom';
import { inject, observer } from 'mobx-react';
import { getEnv } from 'mobx-state-tree';
import { Message, Container } from 'semantic-ui-react';

import { branding } from './helpers/settings';

// expected props
// - pluginRegistry (via injection)
// - app (via injection)
// - location (from react router)
class AppContainer extends Component {
  componentDidMount() {
    document.title = branding.page.title;
  }

  render() {
    const { location, pluginRegistry, app } = this.props;
    let plugins = _.reverse(pluginRegistry.getPluginsWithMethod('app-component', 'getAppComponent') || []);
    let App = this.renderError();

    // We ask each plugin in reverse order if they have the App component
    _.forEach(plugins, plugin => {
      const result = plugin.getAppComponent({ location, appContext: getEnv(app) });
      if (_.isUndefined(result)) return;
      App = result;
      // eslint-disable-next-line consistent-return
      return false; // This will stop lodash from continuing the forEach loop
    });

    plugins = _.reverse(pluginRegistry.getPluginsWithMethod('app-component', 'getAutoLogoutComponent') || []);
    let AutoLogout = () => <></>;
    // We ask each plugin in reverse order if they have the AutoLogout component
    _.forEach(plugins, plugin => {
      const result = plugin.getAutoLogoutComponent({ location, appContext: getEnv(app) });
      if (_.isUndefined(result)) return;
      AutoLogout = result;
      // eslint-disable-next-line consistent-return
      return false; // This will stop lodash from continuing the forEach loop
    });

    return (
      <>
        <AutoLogout />
        <App />
      </>
    );
  }

  renderError() {
    return (
      <Container>
        <Message negative className="clearfix mt4">
          <Message.Header>A problem was encountered</Message.Header>
          <p>No plugins provided the App react component!</p>
        </Message>
      </Container>
    );
  }
}

export default inject('pluginRegistry', 'app')(withRouter(observer(AppContainer)));
