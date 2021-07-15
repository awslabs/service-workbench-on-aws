import _ from 'lodash';
import React from 'react';
import { decorate, computed, action, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Button, Header, Grid, Table, List } from 'semantic-ui-react';

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
    const isDisabled = id => appStreamGeneratingId !== id && !_.isEmpty(appStreamGeneratingId);
    const isLoading = id => appStreamGeneratingId === id;

    return (
      <>
        {_.map(connections, item => (
          <>
            {this.renderAppstreamInstructions(item)}
            <Table.Row key={item.id}>
              <Table.Cell className="clearfix">
                <Button
                  floated="right"
                  size="mini"
                  primary
                  disabled={isDisabled(item.id)}
                  loading={isLoading(item.id)}
                  onClick={this.handleGenerateAppStreamUrl(item.id)}
                >
                  Generate URL
                </Button>

                <div className="mt1">{item.name || 'Generate'}</div>
              </Table.Cell>
            </Table.Row>

            {destinationUrl && (
              <>
                <Table.Row key={`${item.id}_destination`} className="fadeIn animated">
                  <Table.Cell colSpan="3" className="p3">
                    <Grid columns={2} stackable key={`${item.id}__2`}>
                      <Grid.Row stretched>
                        <Grid.Column width={12}>
                          <div>
                            Click on this icon to copy the workspace destination URL:
                            <CopyToClipboard text={destinationUrl} />
                          </div>
                        </Grid.Column>
                      </Grid.Row>
                    </Grid>
                  </Table.Cell>
                </Table.Row>

                <Table.Row key={`${item.id}__3`}>
                  <Table.Cell>
                    <Button
                      floated="right"
                      size="mini"
                      primary
                      onClick={this.handleAppStreamConnect(streamingUrl, item.id)}
                    >
                      Connect
                    </Button>
                  </Table.Cell>
                </Table.Row>
              </>
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
      <>
        <Table.Row key={`${item.id}__4`}>
          <Table.Cell className="clearfix">
            <b>Connection instructions for your AppStream workspace:</b>
            <List bulleted>
              <List.Item>Click the &apos;Generate URL&apos; button to start an AppStream Firefox session</List.Item>
              <List.Item>Copy the destination URL that becomes available below</List.Item>
              <List.Item>Paste (Ctrl + V) this destination URL in the new AppStream FireFox tab</List.Item>
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
  appStreamGeneratingId: observable,
  destinationUrl: observable,
  streamingUrl: observable,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentHttpConnections)));
