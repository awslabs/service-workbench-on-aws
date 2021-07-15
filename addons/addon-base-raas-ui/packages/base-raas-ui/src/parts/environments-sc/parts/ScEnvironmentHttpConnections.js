import _ from 'lodash';
import React from 'react';
import { decorate, computed, action, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Button, Header, Table, List } from 'semantic-ui-react';

import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import ScEnvHttpConnectionExpanded from './ScEnvHttpConnectionExpanded';

const openWindow = (url, windowFeatures) => {
  return window.open(url, '_blank', windowFeatures);
};

// expected props
// - environment (via prop)
// - scEnvironmentsStore (via injection)
class ScEnvironmentHttpConnections extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // The id of the connection that is being processed
      this.processingId = '';
      this.destinationUrl = undefined;
      this.timeout = 10;
    });
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  getConnectionStore() {
    return this.envsStore.getScEnvConnectionStore(this.environment.id);
  }

  // Returns only the connections that either have a scheme = 'http' or 'https' or no scheme
  // [ {id, name: <string>(optional), url: <string>(optional)}, ... ]
  get connections() {
    const isHttp = scheme => scheme === 'http' || scheme === 'https' || _.isEmpty(scheme);
    const connections = this.environment.getConnections(item => isHttp(item.scheme));

    return connections;
  }

  handleConnect = id =>
    action(async () => {
      const store = this.getConnectionStore();
      const connections = this.environment.connections;
      const connectInfo = _.find(connections, ['id', id]) || {};
      let url = connectInfo.url;

      this.processingId = id;
      try {
        if (url) {
          // We use noopener and noreferrer for good practices https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener
          openWindow(url, 'noopener,noreferrer');
        } else {
          const urlObj = await store.createConnectionUrl(id);
          url = urlObj.url;

          // If AppStream is enabled, copy destination URL to clipboard before new tab loads
          if (process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true') {
            runInAction(() => {
              this.destinationUrl = urlObj.appstreamDestinationUrl;
            });
            // Allow users time to copy the destination URL
            setTimeout(() => {
              const newTab = openWindow('about:blank');
              newTab.location = url;
            }, this.timeout * 1000);
          } else {
            const newTab = openWindow('about:blank');
            newTab.location = url;
          }
        }
      } catch (error) {
        displayError(error);
      } finally {
        runInAction(() => {
          this.processingId = '';
        });
      }
    });

  render() {
    const env = this.environment;
    const state = env.state;
    const canConnect = state.canConnect;
    const connections = this.connections;
    const destinationUrl = this.destinationUrl;
    const processingId = this.processingId;
    const isDisabled = id => processingId !== id && !_.isEmpty(processingId);
    const isLoading = id => processingId === id;
    if (!canConnect) return null;

    return (
      <div className="mt2 mb2">
        <Table celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="1">HTTP Connections</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {_.map(connections, item => (
              <>
                {process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true' ? (
                  this.renderAppstreamInstructions(item)
                ) : (
                  <></>
                )}
                <Table.Row key={item.id}>
                  <Table.Cell className="clearfix">
                    <Button
                      floated="right"
                      size="mini"
                      primary
                      disabled={isDisabled(item.id)}
                      loading={isLoading(item.id)}
                      onClick={this.handleConnect(item.id)}
                    >
                      Connect
                    </Button>

                    <div className="mt1">{item.name || 'Connect'}</div>
                  </Table.Cell>
                </Table.Row>
                {destinationUrl ? (
                  <ScEnvHttpConnectionExpanded
                    key={`${item.id}_destination`}
                    destinationUrl={destinationUrl}
                    keyName={`${item.id}_destinationUrl`}
                    connectionId={item.id}
                    timeout={this.timeout}
                  />
                ) : (
                  <></>
                )}
              </>
            ))}
          </Table.Body>
        </Table>
      </div>
    );
  }

  renderAppstreamInstructions(item) {
    return (
      <>
        <Table.Row key={`${item.id}__2`}>
          <Table.Cell className="clearfix">
            <b>Connection instructions for your {item.id} AppStream workspace:</b>
            <List bulleted>
              <List.Item className="flex" key={`${item.id}_list_1`}>
                Step 1: Click the Connect button to start an AppStream session
              </List.Item>
              <List.Item className="flex" key={`${item.id}_list_2`}>
                Step 2: Copy the destination URL that becomes available below
              </List.Item>
              <List.Item className="flex" key={`${item.id}_list_3`}>
                Step 3: Paste (Ctrl + V) this destination URL in the new AppStream FireFox tab
              </List.Item>
            </List>
          </Table.Cell>
        </Table.Row>
      </>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder className="mt2 mb2">
        <Header icon className="color-grey">
          <Icon name="linkify" />
          No HTTP Connections
          <Header.Subheader>This workspace does not have any defined HTTP connections.</Header.Subheader>
        </Header>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentHttpConnections, {
  envsStore: computed,
  environment: computed,
  connections: computed,
  processingId: observable,
  destinationUrl: observable,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentHttpConnections)));
