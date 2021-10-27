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
/* eslint-disable max-classes-per-file */
import React from 'react';
import { decorate, computed } from 'mobx';
import { observer, inject, Observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Label, Popup, TextArea, Tab, Form, Icon, Segment } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import By from '@aws-ee/base-ui/dist/parts/helpers/By';
import { displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';

import KeyPairButtons from './parts/KeyPairButtons';

// This component is used with the TabPane to replace the default Segment wrapper since
// we don't want to display the border.
// eslint-disable-next-line react/prefer-stateless-function
class TabPaneWrapper extends React.Component {
  render() {
    return <>{this.props.children}</>;
  }
}

// expected props
// - keyPair (via prop)
class KeyPairCard extends React.Component {
  get keyPair() {
    return this.props.keyPair;
  }

  render() {
    const keyPair = this.keyPair;

    return (
      <>
        {this.renderStatus(keyPair)}
        {this.renderTitle(keyPair)}
        {keyPair.desc || 'No description was provided.'}
        {this.renderTabs(keyPair)}
      </>
    );
  }

  renderButtons(keyPair) {
    return <KeyPairButtons keyPair={keyPair} />;
  }

  renderTabs(keyPair) {
    const panes = [
      {
        menuItem: 'Public Key',
        render: () => (
          <Tab.Pane attached={false} key="public-key" as={TabPaneWrapper}>
            <Observer>{() => this.renderPublicKey(keyPair)}</Observer>
          </Tab.Pane>
        ),
      },
      {
        menuItem: 'Private Key',
        render: () => (
          <Tab.Pane attached={false} key="private-key" as={TabPaneWrapper}>
            <Observer>{() => this.renderPrivateKey()}</Observer>
          </Tab.Pane>
        ),
      },
    ];

    return <Tab className="mt2" menu={{ secondary: true, pointing: true }} renderActiveOnly panes={panes} />;
  }

  renderDesc(keyPair) {
    return <p>{keyPair.desc || 'No description was provided.'}</p>;
  }

  renderPublicKey(keyPair) {
    return (
      <div className="mt2">
        <Form className="flex">
          <TextArea className="flex-auto" rows={10} value={keyPair.publicKey} />
          <Popup
            content="Copy"
            trigger={
              <CopyToClipboard
                className="ml2 mr0 mt2"
                text={keyPair.publicKey}
                style={{ cursor: 'pointer' }}
                onCopy={() => displaySuccess('Copied to clipboard', 'Done')}
              >
                <Icon name="copy outline" size="large" />
              </CopyToClipboard>
            }
          />
        </Form>
      </div>
    );
  }

  renderPrivateKey() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="key" />
          Not Available
          <Header.Subheader>
            The private key is only available for download at the time of creating a key. This application does not
            store the private key.
          </Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderStatus(keyPair) {
    const status = keyPair.statusInfo;

    return (
      <div style={{ cursor: 'default' }}>
        <Popup
          trigger={
            <Label attached="top left" size="mini" color={status.color}>
              {status.display}
            </Label>
          }
        >
          {status.tip}
        </Popup>
      </div>
    );
  }

  renderTitle(keyPair) {
    return (
      <div className="clearfix flex">
        <Header as="h3" className="mt1 flex-auto">
          {keyPair.name}
          <Header.Subheader>
            <span className="fs-8 color-grey">
              Created <TimeAgo date={keyPair.createdAt} className="mr2" />{' '}
              <By uid={keyPair.createdBy} className="mr2" />
            </span>
            <span className="fs-8 color-grey mr2"> {keyPair.id}</span>
          </Header.Subheader>
        </Header>
        <KeyPairButtons keyPair={keyPair} />
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(KeyPairCard, {
  keyPair: computed,
});

export default inject()(withRouter(observer(KeyPairCard)));
