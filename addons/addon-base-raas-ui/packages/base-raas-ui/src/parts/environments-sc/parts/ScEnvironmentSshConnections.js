import _ from 'lodash';
import React from 'react';
import { decorate, computed, action, runInAction, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Button, Header, Table, Message, List } from 'semantic-ui-react';

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

  get isAppStreamEnabled() {
    return process.env.REACT_APP_IS_APP_STREAM_ENABLED === 'true';
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

  renderAppStreamInfo() {
    return (
      <Segment>
        <b>Connection instructions for your AppStream workspace:</b>
        <List bulleted>
          <List.Item>Select your SSH key below. You must have downloaded this already.</List.Item>
          <List.Item>Paste the key&apos;s contents into AppStream Notepad in .PEM format</List.Item>
          <List.Item>
            Save the file in the Downloads folder in .PEM format named like &quot;KeyName.pem&quot; (with quotes)
          </List.Item>
          <List.Item>Open PuttyGen in AppStream and convert your private PEM key to PPK format</List.Item>
          <List.Item>Enter the PPK file and private IP address in Putty to SSH into EC2</List.Item>
          <List.Item>Delete this file once EC2 connection is established</List.Item>
        </List>
        <div className="mt3">More information on connecting to your Linux instance from Windows OS:</div>
        <List bulleted>
          <List.Item
            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/putty.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Connecting from Windows via Putty
          </List.Item>
        </List>
      </Segment>
    );
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
        {this.isAppStreamEnabled && this.renderAppStreamInfo()}
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
              <>
                <ScEnvironmentSshConnectionRow key={item.id} scEnvironment={env} connectionId={item.id} />
              </>
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
