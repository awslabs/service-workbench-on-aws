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
import { decorate, computed, action, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Button, Header, Table, List } from 'semantic-ui-react';

import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import CopyToClipboard from '../../helpers/CopyToClipboard';

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
      this.appStreamGeneratingId = '';
      this.appStreamConnectingId = '';
      this.destinationUrl = undefined;
      this.streamingUrl = undefined;
      this.timeout = 10;
    });
  }

  get isAppStreamEnabled() {
    return process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true';
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

      runInAction(() => {
        this.processingId = id;
      });

      try {
        if (url) {
          // We use noopener and noreferrer for good practices https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener
          openWindow(url, 'noopener,noreferrer');
        } else {
          const urlObj = await store.createConnectionUrl(id);
          url = urlObj.url;

          if (url) {
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

  handleAppStreamConnect = (url, id) =>
    action(async () => {
      try {
        runInAction(() => {
          this.appStreamConnectingId = id;
        });
        if (url) {
          const newTab = openWindow('about:blank');
          newTab.location = url;
        }
      } catch (error) {
        displayError(error);
      } finally {
        runInAction(() => {
          this.appStreamConnectingId = '';
        });
      }
    });

  handleGenerateAppStreamUrl = id =>
    action(async () => {
      const store = this.getConnectionStore();
      runInAction(() => {
        this.appStreamGeneratingId = id;
      });
      try {
        const urlObj = await store.createConnectionUrl(id);
        runInAction(() => {
          this.destinationUrl = urlObj.appstreamDestinationUrl;
          this.streamingUrl = urlObj.url;
        });
      } catch (error) {
        displayError(error);
      } finally {
        runInAction(() => {
          this.appStreamGeneratingId = '';
        });
      }
    });

  render() {
    const env = this.environment;
    const state = env.state;
    const canConnect = state.canConnect;
    const connections = this.connections;
    if (!canConnect) return null;

    return (
      <div className="mt2 mb2">
        {this.renderAppstreamInstructions(_.first(connections))}
        <Table celled>
          <Table.Header>
            <Table.Row key={env.id}>
              <Table.HeaderCell colSpan="1">HTTP Connections</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>{this.renderBody(connections)}</Table.Body>
        </Table>
      </div>
    );
  }

  renderAppStreamBody(connections) {
    const appStreamGeneratingId = this.appStreamGeneratingId;
    const streamingUrl = this.streamingUrl;
    const destinationUrl = this.destinationUrl;
    const appStreamConnectingId = this.appStreamConnectingId;
    const isDisabled = (id1, id2) => id2 !== id1 && !_.isEmpty(id2);
    const isLoading = (id1, id2) => id2 === id1;

    // Content is hidden from customer, because content is only needed for E2E tests
    const destinationUrlStyle = {
      display: 'none',
    };
    return (
      <>
        {_.map(connections, item => (
          <>
            <Table.Row key={item.id}>
              <Table.Cell className="clearfix">
                <Button
                  floated="right"
                  size="mini"
                  primary
                  disabled={isDisabled(item.id, appStreamGeneratingId)}
                  loading={isLoading(item.id, appStreamGeneratingId)}
                  onClick={this.handleGenerateAppStreamUrl(item.id)}
                  data-testid="sc-environment-generate-url-button"
                >
                  Generate URL
                </Button>

                <div className="mt1">{item.name || 'Generate'}</div>
              </Table.Cell>
            </Table.Row>

            {destinationUrl && (
              <Table.Row key={`${item.id}_destination`} className="fadeIn animated">
                <Table.Cell colSpan="3" className="p3">
                  Click here to copy the destination URL:
                  <CopyToClipboard text={destinationUrl} />
                  <span data-testid="destination-url" style={destinationUrlStyle}>
                    {destinationUrl}
                  </span>
                  <Button
                    floated="right"
                    size="mini"
                    primary
                    disabled={isDisabled(item.id, appStreamConnectingId)}
                    loading={isLoading(item.id, appStreamConnectingId)}
                    onClick={this.handleAppStreamConnect(streamingUrl, item.id)}
                    data-testid="connect-to-workspace-button"
                  >
                    Connect
                  </Button>
                </Table.Cell>
              </Table.Row>
            )}
          </>
        ))}
      </>
    );
  }

  renderBody(connections) {
    if (this.isAppStreamEnabled) {
      return this.renderAppStreamBody(connections);
    }

    const processingId = this.processingId;
    const isDisabled = id => processingId !== id && !_.isEmpty(processingId);
    const isLoading = id => processingId === id;
    return (
      <>
        {_.map(connections, item => (
          <>
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
          </>
        ))}
      </>
    );
  }

  renderAppstreamInstructions(item) {
    return (
      this.isAppStreamEnabled && (
        <Segment key={`${item.id}__4`} className="clearfix" data-testid="appstream-instructions-http">
          <b>Connection instructions for your AppStream workspace:</b>
          <List bulleted>
            <List.Item>Click the &quot;Generate URL&quot; button to create the destination URL</List.Item>
            <List.Item>Copy the URL and hit &quot;Connect&quot;. </List.Item>
            <List.Item>Paste the URL in the new AppStream FireFox tab</List.Item>
            <List.Item>
              In your browser, please allow popups for this domain so we can open the AppStream page in a new tab for
              you
            </List.Item>
          </List>
        </Segment>
      )
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
  appStreamGeneratingId: observable,
  appStreamConnectingId: observable,
  destinationUrl: observable,
  streamingUrl: observable,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentHttpConnections)));
