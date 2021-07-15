import _ from 'lodash';
import React from 'react';
import { decorate, computed, action, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button, Table, Dropdown, Grid } from 'semantic-ui-react';

import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import ScEnvSshConnRowExpanded from './ScEnvSshConnRowExpanded';

const openWindow = (url, windowFeatures) => {
  return window.open(url, '_blank', windowFeatures);
};

// expected props
// - scEnvironment (via prop)
// - connectionId (via prop)
// - scEnvironmentsStore (via injection)
// - keyPairsStore  (vai injection)
class ScEnvironmentSshConnectionRow extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      const key = _.first(this.keyPairsStore.listActive) || {};

      // The networksInterfaces we get once we send the ssh key
      this.networkInterfaces = undefined;
      // A flag to indicate if the activation of ssh is being processed
      this.processingSendKey = false;
      // We default the selected key (if any) to the first latest active key
      this.selectedKeyId = key.id;
      this.appStreamUrl = undefined;
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

  get keyPairsStore() {
    return this.props.keyPairsStore;
  }

  get keyPairOptions() {
    return _.map(this.keyPairsStore.listActive, item => ({ key: item.id, value: item.id, text: item.name }));
  }

  getConnectionStore() {
    return this.envsStore.getScEnvConnectionStore(this.environment.id);
  }

  // Returns only the connections that scheme = 'ssh'
  // [ {id, name: <string>(optional), instanceId: <string>, scheme: 'ssh'}, ... ]
  get connections() {
    const connections = this.environment.getConnections(item => item.scheme === 'ssh');

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

  get selectedKeyName() {
    if (_.isEmpty(this.selectedKeyId)) return '';
    return _.get(this.keyPairsStore.getKeyPair(this.selectedKeyId), 'name');
  }

  handleActivate = async () => {
    const keyId = this.selectedKeyId;
    const store = this.getConnectionStore();
    const connectionId = this.connectionId;
    if (_.isEmpty(keyId)) {
      displayError('Please select the name of the key pair that you want to use');
      return;
    }

    this.networkInterfaces = undefined;
    this.processingSendKey = true;
    try {
      const result = await store.sendSshKey(connectionId, keyId);

      runInAction(() => {
        this.networkInterfaces = _.get(result, 'networkInterfaces');
      });
    } catch (error) {
      displayError(error);
    } finally {
      runInAction(() => {
        this.processingSendKey = false;
      });
    }
  };

  handleConnect = () =>
    action(async () => {
      try {
        const connectionId = this.connectionId;
        const store = this.getConnectionStore();
        const urlObj = await store.createConnectionUrl(connectionId);
        const appStreamUrl = urlObj.url;
        if (appStreamUrl) {
          // We use noopener and noreferrer for good practices https://developer.mozilla.org/en-US/docs/Web/API/Window/open#noopener
          openWindow(appStreamUrl, 'noopener,noreferrer');
          const newTab = openWindow('about:blank');
          newTab.location = appStreamUrl;
        } else {
          throw Error('AppStream URL was not returned by the API');
        }
        this.processingId = connectionId;
      } catch (error) {
        displayError(error);
      } finally {
        runInAction(() => {
          this.processingId = '';
        });
      }
    });

  handleKeyChange = (e, data) => {
    const value = _.get(data, 'value');
    const changed = value !== this.selectedKeyId;
    this.selectedKeyId = value;

    if (changed) this.networkInterfaces = undefined;
  };

  render() {
    const store = this.keyPairsStore;
    const emptyKeys = _.isEmpty(store.listActive);
    const item = this.connection;
    const networkInterfaces = this.networkInterfaces;
    const options = this.keyPairOptions;
    const selectedKeyId = this.selectedKeyId;
    const selectedKeyName = this.selectedKeyName;

    const rows = [
      <Table.Row key={item.id}>
        <Table.Cell>
          <div className="mt1">{item.name || item.instanceId}</div>
        </Table.Cell>
        <Table.Cell>
          {emptyKeys && 'No key pair found'}
          {!emptyKeys && (
            <Dropdown
              upward
              placeholder="Select Key"
              fluid
              selection
              options={options}
              value={selectedKeyId}
              onChange={this.handleKeyChange}
              disabled={emptyKeys || this.processingSendKey}
            />
          )}
        </Table.Cell>
        <Table.Cell collapsing>
          <Button
            primary
            size="mini"
            onClick={this.handleActivate}
            disabled={emptyKeys}
            loading={this.processingSendKey}
          >
            Use this SSH Key
          </Button>
        </Table.Cell>
      </Table.Row>,
    ];

    if (networkInterfaces) {
      rows.push(
        <ScEnvSshConnRowExpanded
          key={`${item.id}__1`}
          networkInterfaces={networkInterfaces}
          keyName={selectedKeyName}
          connectionId={item.id}
          appStreamUrl={this.appStreamUrl}
        />,
      );
    }

    if (this.isAppStreamEnabled && !_.isUndefined(networkInterfaces)) {
      rows.push(
        <Table.Row key={`${item.id}__2`}>
          <Table.Cell>
            <Grid.Column width={12}>
              <Button floated="right" size="mini" primary onClick={this.handleConnect(item.id)}>
                Connect
              </Button>
            </Grid.Column>
          </Table.Cell>
        </Table.Row>,
      );
    }

    return rows;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentSshConnectionRow, {
  envsStore: computed,
  environment: computed,
  keyPairsStore: computed,
  connections: computed,
  connection: computed,
  connectionId: computed,
  keyPairOptions: computed,
  selectedKeyName: computed,
  selectedKeyId: observable,
  networkInterfaces: observable,
  processingSendKey: observable,
  appStreamUrl: observable,
  handleActivate: action,
  handleKeyChange: action,
});

export default inject('scEnvironmentsStore', 'keyPairsStore')(withRouter(observer(ScEnvironmentSshConnectionRow)));
