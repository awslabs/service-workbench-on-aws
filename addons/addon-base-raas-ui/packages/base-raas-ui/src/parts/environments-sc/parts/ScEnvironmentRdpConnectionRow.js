import _ from 'lodash';
import React from 'react';
import { decorate, computed, action, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button, Table, List, Label } from 'semantic-ui-react';

import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import CopyToClipboard from '../../helpers/CopyToClipboard';

const openWindow = (url, windowFeatures) => {
  return window.open(url, '_blank', windowFeatures);
};

// expected props
// - scEnvironment (via prop)
// - connectionId (via prop)
// - scEnvironmentsStore (via injection)
class ScEnvironmentRdpConnectionRow extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // The windowsRdpInfo we get once we ask for the windows rdp info
      // This is an object { password: <string>, networkInterfaces: [ ... ] }
      this.windowsRdpInfo = undefined;
      // A flag to indicate if we are in the process of getting the windows rdp info
      this.processingGetInfo = false;
      // A flag to indicate if we're getting the connection url
      this.processingGetConnection = false;
      // Should the password be shown
      this.showPassword = false;
      this.processingId = undefined;
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

  // Returns only the connections that scheme = 'rdp'
  // [ {id, name: <string>(optional), instanceId: <string>, scheme: 'rdp'}, ... ]
  get connections() {
    const connections = this.environment.getConnections(item => item.scheme === 'rdp');

    return connections;
  }

  get connection() {
    const id = this.connectionId;
    const connections = this.connections;

    return _.find(connections, ['id', id]) || {};
  }

  get connectionId() {
    return this.props.connectionId;
  }

  get networkInterfaces() {
    const entries = _.get(this.windowsRdpInfo, 'networkInterfaces');
    if (_.isEmpty(entries)) return [];

    const result = [];
    _.forEach(entries, item => {
      if (item.publicDnsName) result.push({ value: item.publicDnsName, type: 'dns', scope: 'public', info: 'Public' });
      if (item.privateIp) result.push({ value: item.privateIp, type: 'ip', scope: 'private', info: 'Private' });
    });

    return result;
  }

  handleConnect = id =>
    action(async () => {
      try {
        runInAction(() => {
          this.processingGetConnection = true;
        });
        const store = this.getConnectionStore();
        const urlObj = await store.createConnectionUrl(id);
        const appStreamUrl = urlObj.url;
        if (appStreamUrl) {
          const newTab = openWindow('about:blank');
          newTab.location = appStreamUrl;
        } else {
          throw Error('AppStream URL was not returned by the API');
        }
        runInAction(() => {
          this.processingGetConnection = false;
          this.processingId = id;
        });
      } catch (error) {
        displayError(error);
      } finally {
        runInAction(() => {
          this.processingId = '';
        });
      }
    });

  handleGetInfo = async () => {
    const store = this.getConnectionStore();
    const connectionId = this.connectionId;

    runInAction(() => {
      this.windowsRdpInfo = undefined;
      this.showPassword = false;
      this.processingGetInfo = true;
    });

    try {
      const result = await store.getWindowsRdpInfo(connectionId);
      runInAction(() => {
        this.windowsRdpInfo = result || {};
      });
    } catch (error) {
      displayError(error);
    } finally {
      runInAction(() => {
        this.processingGetInfo = false;
      });
    }
  };

  toggleShowPassword = () => {
    this.showPassword = !this.showPassword;
  };

  render() {
    const item = this.connection;
    const windowsRdpInfo = this.windowsRdpInfo;
    const processing = this.processingGetInfo;

    const rows = [
      <Table.Row key={item.id}>
        <Table.Cell className="clearfix">
          <Button
            data-testid="get-password-button"
            floated="right"
            size="mini"
            primary
            loading={processing}
            onClick={this.handleGetInfo}
          >
            Get Password
          </Button>

          <div className="mt1">{item.name || 'Connect'}</div>
        </Table.Cell>
      </Table.Row>,
    ];

    if (windowsRdpInfo) {
      rows.push(this.renderExpanded());
    }

    return rows;
  }

  renderExpanded() {
    const item = this.connection;
    const windowsRdpInfo = this.windowsRdpInfo;
    const interfaces = this.networkInterfaces;
    const username = 'Administrator';
    const password = windowsRdpInfo.password;
    const showPassword = this.showPassword;
    const connectionId = this.connectionId;
    const moreThanOne = _.size(interfaces) > 1;

    return (
      <>
        <Table.Row key={`${item.id}__2`}>
          <Table.Cell className="p3">
            <b>
              Your Windows workspace can be accessed via an RDP client by using the DNS host name and credentials
              defined below.
            </b>
            <List bulleted>
              {!this.isAppStreamEnabled && (
                <List.Item>
                  The IP Address or DNS of the instance.{' '}
                  {moreThanOne ? 'Ask your administrator if you are not sure which one to use:' : ''}
                  <List>
                    {_.map(interfaces, network => (
                      <List.Item key={network.value} className="flex">
                        {this.renderHostLabel(network)}
                        <CopyToClipboard text={network.value} />
                      </List.Item>
                    ))}
                  </List>
                </List.Item>
              )}

              <List.Item>
                The username and password:
                <List>
                  <List.Item className="flex">
                    {this.renderUsernameLabel(username)}
                    <CopyToClipboard text={username} />
                  </List.Item>
                  <List.Item className="flex">
                    {this.renderPasswordLabel(password)}
                    <Button className="ml2" basic size="mini" onClick={this.toggleShowPassword}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Button>
                    <CopyToClipboard text={password} />
                  </List.Item>
                </List>
              </List.Item>
            </List>
            <div className="mt3">
              Additional information about connecting via RDP can be found in the documentation below:
            </div>
            <List bulleted>
              <List.Item
                href="https://docs.aws.amazon.com/AWSEC2/latest/WindowsGuide/connecting_to_windows_instance.html#connect-rdp"
                target="_blank"
                rel="noopener noreferrer"
              >
                Connect to Your Windows Instance
              </List.Item>
            </List>
            {this.isAppStreamEnabled && (
              <div className="mt3">
                In your browser, please allow popups for this domain so we can open the AppStream page in a new tab for
                you
              </div>
            )}
          </Table.Cell>
        </Table.Row>

        {this.isAppStreamEnabled && windowsRdpInfo && (
          <Table.Row>
            <Table.Cell>
              <Button
                primary
                size="mini"
                onClick={this.handleConnect(connectionId)}
                floated="right"
                disabled={this.processingId}
                loading={this.processingGetConnection}
                data-testid="connect-to-workspace-button"
              >
                Connect
              </Button>
            </Table.Cell>
          </Table.Row>
        )}
      </>
    );
  }

  renderPasswordLabel(password) {
    const showPassword = this.showPassword;
    return (
      <Label>
        Password
        <Label.Detail>{showPassword ? password : '****************'}</Label.Detail>
      </Label>
    );
  }

  renderUsernameLabel(username) {
    return (
      <Label>
        Username
        <Label.Detail>{username}</Label.Detail>
      </Label>
    );
  }

  renderHostLabel(network) {
    return (
      <Label>
        Host
        <Label.Detail>
          {network.value} <span className="fs-7 pl1">({network.info})</span>
        </Label.Detail>
      </Label>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentRdpConnectionRow, {
  envsStore: computed,
  environment: computed,
  connections: computed,
  connection: computed,
  connectionId: computed,
  networkInterfaces: computed,
  processingId: observable,
  windowsRdpInfo: observable,
  processingGetInfo: observable,
  processingGetConnection: observable,
  showPassword: observable,
  handleGetInfo: action,
  toggleShowPassword: action,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentRdpConnectionRow)));
