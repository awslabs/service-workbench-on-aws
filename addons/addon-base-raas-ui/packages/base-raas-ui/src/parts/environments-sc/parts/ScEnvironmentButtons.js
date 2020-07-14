import _ from 'lodash';
import React from 'react';
import { decorate, computed, action, observable, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button, Menu, Icon, Dropdown, Modal } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

const openWindow = (url, windowFeatures) => {
  return window.open(url, '_blank', windowFeatures);
};

// expected props
// - scEnvironment (via prop)
// - showDetailButton (via prop)
class ScEnvironmentButtons extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // The name of the button that is clicked recently and resulted in triggering a processing task
      // The name can be: 'terminate' or 'connect'
      this.processingButton = '';
    });
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  // Returns only the connections that either have a scheme = 'http' or 'https' or no scheme
  // [ {id, index: <integer>, name: <string>(optional), url: <string>(optional)}, ... ]
  get connections() {
    const isHttp = scheme => scheme === 'http' || scheme === 'https' || _.isEmpty(scheme);
    const connections = [];
    _.forEach(this.environment.connections, (item, index) => {
      if (!isHttp(item.scheme)) return;

      connections.push({
        id: item.id,
        index,
        name: item.name,
        url: item.url,
      });
    });

    return connections;
  }

  handleViewDetail = () => {
    const goto = gotoFn(this);
    goto(`/workspaces/id/${this.environment.id}`);
  };

  handleTerminate = async () => {
    this.processingButton = 'terminate';
    try {
      const store = this.envsStore;
      await store.terminateScEnvironment(this.environment.id);
    } catch (error) {
      displayError(error);
    } finally {
      runInAction(() => {
        this.processingButton = '';
      });
    }
  };

  handleConnect = id =>
    action(async () => {
      this.processingButton = 'connect';
      const store = this.envsStore;
      const connections = this.environment.connections;
      const connectInfo = _.find(connections, ['id', id]) || {};
      let url = connectInfo.url;

      try {
        if (url) {
          // We use noopener and noreferrer for good practices https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener
          openWindow(url, 'noopener,noreferrer');
        } else {
          const newTab = openWindow('about:blank');
          url = await store.getConnectionUrl(this.environment.id, id);
          newTab.location = url;
        }
      } catch (error) {
        displayError(error);
      } finally {
        runInAction(() => {
          this.processingButton = '';
        });
      }
    });

  render() {
    const env = this.environment;
    const state = env.state;
    const processing = this.processingButton;
    const showDetailButton = this.props.showDetailButton;
    const is = name => processing === name;
    const isProcessingTerminate = is('terminate');
    const canConnect = state.canConnect;
    const showLeftButtons = canConnect || showDetailButton;

    return (
      <div style={{ minHeight: '42px' }}>
        {state.canTerminate && (
          <Modal
            trigger={
              <Button floated="right" basic color="red" size="mini" className="mt1 mb1" loading={isProcessingTerminate}>
                Terminate
              </Button>
            }
            header="Are you sure?"
            content="This action can not be reverted."
            actions={[
              'Cancel',
              { key: 'terminate', content: 'Terminate', negative: true, onClick: this.handleTerminate },
            ]}
            size="mini"
          />
        )}

        {showLeftButtons && (
          <Menu size="mini" compact className="mt1 mb1">
            {this.renderConnections()}
            {showDetailButton && <Menu.Item name="View Detail" onClick={this.handleViewDetail} />}
          </Menu>
        )}
      </div>
    );
  }

  renderConnections() {
    const env = this.environment;
    const state = env.state;
    const processing = this.processingButton;
    const is = name => processing === name;
    const isProcessingConnect = is('connect');
    const connections = this.connections;
    const size = _.size(connections);

    if (!state.canConnect) return null;
    if (size === 1) {
      return (
        <Menu.Item name="Connect" onClick={this.handleConnect(connections[0].id)} disabled={isProcessingConnect}>
          Connect
          {isProcessingConnect && <Icon className="ml1" name="spinner" loading />}
        </Menu.Item>
      );
    }

    return (
      <Dropdown item text="Connect" disabled={isProcessingConnect} loading={isProcessingConnect}>
        <Dropdown.Menu>
          {_.map(connections, item => (
            <Dropdown.Item key={item.id} onClick={this.handleConnect(item.id)}>
              {item.name || 'Connect'}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentButtons, {
  envsStore: computed,
  environment: computed,
  connections: computed,
  processingButton: observable,
  handleViewDetail: action,
  handleTerminate: action,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentButtons)));
