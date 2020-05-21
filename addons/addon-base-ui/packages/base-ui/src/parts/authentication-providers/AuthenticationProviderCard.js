import _ from 'lodash';
import { observer } from 'mobx-react';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { Button, Header, Label } from 'semantic-ui-react';
import { gotoFn } from '../../helpers/routing';

// expected props
// - authenticationProviderConfig
// - pos
class AuthenticationProviderCard extends Component {
  render() {
    const authenticationProviderConfig = this.getAuthenticationProviderConfig();
    return (
      // The custom attribute "data-id" here is used for conveying the id of the virtualDatabase being clicked in the "handleVirtualDatabaseClick" handler
      <div className="flex">
        <div className="flex-auto">
          <div className="flex">
            {this.renderIndexLabel()}
            <Header as="h2" color="grey" className="mt0">
              {authenticationProviderConfig.config.title}{' '}
              <span className="pl2 fs-9 breakout">{authenticationProviderConfig.id}</span>
              <div>{this.renderStatus(authenticationProviderConfig)}</div>
            </Header>
            <div className="ml-auto">{this.renderActionButtons()}</div>
          </div>
          <div className="ml3 mb2 mt2 breakout">{authenticationProviderConfig.config.type.description}</div>
        </div>
      </div>
    );
  }

  getAuthenticationProviderConfig() {
    return this.props.authenticationProviderConfig;
  }

  renderStatus(authenticationProviderConfig) {
    const isActive = _.toLower(authenticationProviderConfig.status) === 'active';
    return <Label color={isActive ? 'green' : 'red'}>{authenticationProviderConfig.status}</Label>;
  }

  renderIndexLabel() {
    const pos = this.props.pos;
    return (
      <Label size="mini" ribbon color="blue" className="line-height-20-px">
        {pos}
      </Label>
    );
  }

  renderActionButtons() {
    return (
      <Button.Group basic size="mini">
        <Button icon="edit" onClick={this.handleEditModeClick} />
      </Button.Group>
    );
  }

  handleEditModeClick = event => {
    event.preventDefault();
    event.stopPropagation();
    const id = this.getAuthenticationProviderConfig().id;
    const goto = gotoFn(this);
    goto(`/authentication-providers/${encodeURIComponent(id)}/edit`);
  };
}

export default withRouter(observer(AuthenticationProviderCard));
