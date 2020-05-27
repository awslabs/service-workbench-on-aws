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

import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Header, Icon, Accordion, Table, Button, Label } from 'semantic-ui-react';

import TimeAgo from 'react-timeago';
import _ from 'lodash';
import { swallowError } from '../../helpers/utils';
import { isStoreEmpty, isStoreError, isStoreLoading, isStoreNotEmpty, isStoreReady } from '../../models/BaseStore';
import Progress from '../helpers/Progress';
import ErrorBox from '../helpers/ErrorBox';
import { displayError } from '../../helpers/notification';

// expected props
// - userApiKeysStore (via injection)
class ApiKeysList extends Component {
  getStore() {
    return this.props.userApiKeysStore.getCurrentUserApiKeysStore();
  }

  componentDidMount() {
    const store = this.getStore();
    swallowError(store.load());
  }

  render() {
    const store = this.getStore();
    let content;
    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} />;
    } else if (isStoreLoading(store)) {
      content = (
        <div className="m3">
          <Progress />
        </div>
      );
    } else if (isStoreReady(store) && isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreReady(store) && isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }
    return <div className="mt3 ml3 mr3 animated fadeIn">{content}</div>;
  }

  renderEmpty() {
    return (
      <Container text className="mt4 center">
        <Header as="h2" icon textAlign="center" className="mt3" color="grey">
          <Icon name="key" circular />
          <div className="mt3 ml3 mr3 animated fadeIn">You do not have any API Keys.</div>
          <div className="mt3 ml3 mr3 animated fadeIn">
            <Button color="blue" size="medium" basic onClick={this.handleCreateApiKey}>
              Create New API Key
            </Button>
          </div>
        </Header>
      </Container>
    );
  }

  handleCreateApiKey = async () => {
    try {
      await this.getStore().createNewApiKey();
    } catch (error) {
      displayError(error);
    }
  };

  handleRevokeApiKey = async apiKeyId => {
    try {
      await this.getStore().revokeApiKey(apiKeyId);
    } catch (error) {
      displayError(error);
    }
  };

  renderMain() {
    const apiKeys = _.orderBy(this.getStore().list, ['createdAt', 'status'], ['desc', 'asc']);
    const renderTotal = () => {
      const count = apiKeys.length;
      return (
        <div className="flex mb3">
          <Header as="h2" color="grey" className="flex-auto ml3">
            You have{' '}
            <Label circular size="huge">
              {count}
            </Label>{' '}
            API Keys
          </Header>
          <Button color="blue" size="medium" basic onClick={this.handleCreateApiKey}>
            Create New API Key
          </Button>
        </div>
      );
    };
    const renderRow = (rowNum, apiKey) => {
      const panels = [
        {
          key: `panel-${rowNum}`,
          title: {
            content: <Label color="blue" content={`Key ${rowNum}`} />,
          },
          content: {
            content: (
              <div>
                <textarea style={{ minWidth: '400px' }} rows={7} disabled value={apiKey.key} />
              </div>
            ),
          },
        },
      ];
      return (
        <Table.Row key={rowNum} className="fit animated fadeIn">
          <Table.Cell textAlign="left" collapsing>
            {rowNum}
          </Table.Cell>
          <Table.Cell textAlign="left">
            <Accordion defaultActiveIndex={1} panels={panels} />
          </Table.Cell>
          <Table.Cell textAlign="center" collapsing>
            <TimeAgo date={apiKey.createdAt} />
          </Table.Cell>
          <Table.Cell textAlign="center" collapsing>
            <Label color={apiKey.effectiveStatus === 'active' ? 'green' : 'red'} size="small">
              {_.capitalize(apiKey.effectiveStatus)}
            </Label>
          </Table.Cell>
          <Table.Cell textAlign="center" collapsing>
            <Button size="small" color="red" onClick={() => this.handleRevokeApiKey(apiKey.id)}>
              Revoke
            </Button>
          </Table.Cell>
        </Table.Row>
      );
    };
    const renderTableBody = () => {
      let rowNum = 0;
      return _.map(apiKeys, apiKey => {
        ++rowNum;
        return renderRow(rowNum, apiKey);
      });
    };
    return (
      <Container text className="mt4 center">
        {renderTotal()}
        <div>
          <Table celled striped stackable selectable size="small">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell textAlign="left" collapsing>
                  #
                </Table.HeaderCell>
                <Table.HeaderCell textAlign="left">Key</Table.HeaderCell>
                <Table.HeaderCell textAlign="center" collapsing>
                  Issued
                </Table.HeaderCell>
                <Table.HeaderCell textAlign="center" collapsing>
                  Status
                </Table.HeaderCell>
                <Table.HeaderCell textAlign="center" collapsing />
              </Table.Row>
            </Table.Header>
            <Table.Body>{renderTableBody()}</Table.Body>
          </Table>
        </div>
      </Container>
    );
  }
}

export default inject('userApiKeysStore')(withRouter(observer(ApiKeysList)));
