import _ from 'lodash';
import React from 'react';
import { decorate, computed, action, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Button, Header, Table, Message } from 'semantic-ui-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreLoading, isStoreError, isStoreReady } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import KeyPairCreateForm from '@aws-ee/key-pair-mgmt-ui/dist/parts/key-pairs/parts/KeyPairCreateForm';

import ScEnvironmentSshConnectionRow from './ScEnvironmentSshConnectionRow';

// expected props
// - environment (via prop)
// - keyPairsStore  (vai injection)
class ScEnvironmentSshConnections extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // A flag to indicate if we need to show the create key form
      this.showCreateKey = false;
    });
  }

  componentDidMount() {
    const store = this.keyPairsStore;
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get keyPairsStore() {
    return this.props.keyPairsStore;
  }

  // Returns only the connections that scheme = 'ssh'
  // [ {id, name: <string>(optional), instanceId: <string>, scheme: 'ssh'}, ... ]
  get connections() {
    const connections = this.environment.getConnections(item => item.scheme === 'ssh');

    return connections;
  }

  toggleCreateKey = () => {
    this.showCreateKey = !this.showCreateKey;
  };

  render() {
    const store = this.keyPairsStore;
    const env = this.environment;
    const state = env.state;
    const canConnect = state.canConnect;
    const empty = _.isEmpty(this.connections);

    if (!canConnect) return null;
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="pt2 mb2" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} className="mt2 mb2" />;
    } else if (empty) {
      content = this.renderEmpty();
    } else {
      content = this.renderConnections();
    }

    return <div className="fadeIn animated">{content}</div>;
  }

  renderConnections() {
    const env = this.environment;
    const showCreateKey = this.showCreateKey;
    const connections = this.connections;
    const store = this.keyPairsStore;
    const empty = store.empty;

    if (showCreateKey) return this.renderCreateKeyForm();

    return (
      <div className="mt2 mb2 fadeIn animated">
        {empty && (
          <Message warning>
            <Message.Header>Attention!</Message.Header>
            <Message.List>
              <Message.Item>
                You do not have any key pairs. A key pair is needed to connect via SSH to the target machine.
              </Message.Item>
              <Message.Item>
                You can create a key pair now by clicking on the &apos;Create Key&apos; button below.
              </Message.Item>
            </Message.List>
          </Message>
        )}
        <Table celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell colSpan="3" className="clearfix">
                <div>
                  <Button floated="right" color="blue" size="mini" basic onClick={this.toggleCreateKey}>
                    Create Key
                  </Button>
                </div>
                <div className="mt1">SSH Connections</div>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {_.map(connections, item => (
              <ScEnvironmentSshConnectionRow key={item.id} scEnvironment={env} connectionId={item.id} />
            ))}
          </Table.Body>
        </Table>
      </div>
    );
  }

  renderCreateKeyForm() {
    return (
      <Segment className="clearfix mt2 mb2 p2 fadeIn animated">
        <KeyPairCreateForm onCancel={this.toggleCreateKey} />
      </Segment>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder className="mt2 mb2">
        <Header icon className="color-grey">
          <Icon name="linkify" />
          No SSH Connections
          <Header.Subheader>This workspace does not have any defined SSH connections.</Header.Subheader>
        </Header>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentSshConnections, {
  environment: computed,
  keyPairsStore: computed,
  connections: computed,
  showCreateKey: observable,
  toggleCreateKey: action,
});

export default inject('keyPairsStore')(withRouter(observer(ScEnvironmentSshConnections)));
