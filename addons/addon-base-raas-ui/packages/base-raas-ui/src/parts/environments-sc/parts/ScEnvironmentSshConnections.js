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
      <Segment data-testid="appstream-instructions-ssh">
        <b>Connection instructions for your AppStream workspace:</b>
        <List bulleted>
          <List.Item>Select your SSH key below. Click &quot;Use this SSH key&quot; below</List.Item>
          <List.Item>A private IP will be displayed. This will be used for Putty connection</List.Item>
          <List.Item>Click &quot;Connect&quot; to open an AppStream session window</List.Item>
          <List.Item>
            Copy your private SSH key to AppStream
            <List bulleted>
              <List.Item>You must have downloaded the selected SSH key during creating it</List.Item>
              <List.Item>Paste your SSH key&apos;s contents into Notepad in AppStream</List.Item>
              <List.Item>
                Save the file in the Downloads folder named like &quot;<i>KeyName</i>.pem&quot; (with quotes)
              </List.Item>
            </List>
          </List.Item>
          <List.Item>
            Convert your private key to PPK format.
            <List bulleted>
              <List.Item>
                PuttyGen will already be open in AppStream window. Click &quot;Load&quot; and select your PEM file
              </List.Item>
              <List.Item>
                Click on &quot;Save private key&quot;. Click &quot;Yes&quot; to save without passphrase{' '}
              </List.Item>
            </List>
          </List.Item>
          <List.Item>
            Use PPK file in Putty
            <List bulleted>
              <List.Item>Enter the private IP address in Putty and select SSH connection type</List.Item>
              <List.Item>In the Category pane, expand Connection, expand SSH, and then choose Auth</List.Item>
              <List.Item>Browse and select your PPK file for authentication. Click Open</List.Item>
              <List.Item>When prompted to enter username, enter &quot;ec2-user&quot;</List.Item>
            </List>
          </List.Item>
          <List.Item>Delete your PEM and PPK files once EC2 connection is established</List.Item>
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
        <div className="mt3">
          In your browser, please allow popups for this domain so we can open the AppStream page in a new tab for you
        </div>
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
