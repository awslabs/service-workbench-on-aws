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

import React from 'react';
import { decorate, action, computed, runInAction, observable } from 'mobx';
import { observer } from 'mobx-react';
import { Header, Checkbox, Segment, Accordion, Icon, Label, Table, Button } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';
import c from 'classnames';

// expected props
// - study (via props)
// - isSelectable (via props)
// - filesSelection (via injection)
class AccountCard extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.detailsExpanded = false;
      this.isSelected = false;
      this.statusAt = new Date().toISOString();
    });
  }

  get account() {
    return this.props.account;
  }

  get isSelectable() {
    return this.props.isSelectable;
  }

  get needsUpdate() {
    return this.props.needsUpdate;
  }

  handleDetailsExpanded = () => {
    this.detailsExpanded = !this.detailsExpanded;
  };

  handleSelected = () => {
    this.isSelected = !this.isSelected;
  };

  handleBudgetButton = () => {
    return undefined;
  };

  render() {
    const isSelectable = this.isSelectable; // Internal and external guests can't select studies
    const account = this.account;
    const attrs = {};
    const onClickAttr = {};
    const needsUpdate = this.needsUpdate;

    if (this.isSelected) attrs.color = 'blue';
    if (isSelectable) onClickAttr.onClick = () => this.handleSelected();

    return (
      <Segment clearing padded raised className="mb3" {...attrs}>
        <div className="flex">
          <div className="mr2" {...onClickAttr}>
            {isSelectable && <Checkbox checked={this.isSelected} style={{ marginTop: '31px' }} />}
          </div>
          <div className="flex-auto mb1">
            {this.renderStatus()}
            {this.renderBudgetButton()}
            {this.renderHeader(account)}
            {this.renderDescription(account)}
            {needsUpdate !== false && this.renderUpdatePermsButton()}
            {this.renderDetailsAccordion(account)}
          </div>
        </div>
      </Segment>
    );
  }

  renderHeader(account) {
    const isSelectable = this.isSelectable;
    const onClickAttr = {};
    const idReadable = account.accountId.replace(/(.{4})(.{4})/g, '$1-$2-');
    if (isSelectable) onClickAttr.onClick = () => this.handleSelected();

    return (
      <div>
        <Header as="h3" color="blue" className={c('mt2', isSelectable ? 'cursor-pointer' : '')} {...onClickAttr}>
          {account.name}
          <Header.Subheader>
            <span className="pt1 fs-8 color-grey">AWS Account #{idReadable}</span>
            <span className="fs-8 color-grey mr1">
              &mdash; Permissions checked <TimeAgo date={this.statusAt} className="mr1" />
            </span>
          </Header.Subheader>
        </Header>
      </div>
    );
  }

  renderDescription(account) {
    return <div>{account.description}</div>;
  }

  renderStatus() {
    const needsUpdate = this.needsUpdate;
    const state =
      needsUpdate === undefined
        ? { color: 'blue', display: 'New' }
        : needsUpdate === true
        ? { color: 'orange', display: 'Needs Update' }
        : { color: 'green', display: 'Up-to-Date' };
    return (
      <Label attached="top left" size="mini" color={state.color}>
        {state.display}
      </Label>
    );
  }

  renderDetailsAccordion(account) {
    const expanded = this.detailsExpanded;
    const rowKeyVal = {
      roleArn: 'Role ARN',
      externalId: 'External ID',
      vpcId: 'VPC ID',
      subnetId: 'Subnet ID',
      encryptionKeyArn: 'Encryption Key ARN',
    };

    return (
      <Accordion className="mt2">
        <Accordion.Title active={expanded} index={0} onClick={this.handleDetailsExpanded}>
          <Icon name="dropdown" />
          <b>Details</b>
        </Accordion.Title>
        <Accordion.Content active={expanded}>
          {expanded && (
            <div className="mb2">
              <>
                <Table striped>
                  <Table.Body>
                    {Object.keys(rowKeyVal).map(entry => (
                      <Table.Row key={entry}>
                        <Table.Cell>{rowKeyVal[entry]}</Table.Cell>
                        <Table.Cell>{account[entry]}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </>
            </div>
          )}
        </Accordion.Content>
      </Accordion>
    );
  }

  renderBudgetButton() {
    return (
      <Button floated="right" color="blue" basic onClick={this.handleBudgetButton}>
        Budget Detail
      </Button>
    );
  }

  renderUpdatePermsButton() {
    return (
      <Button
        floated="right"
        color="orange"
        basic
        onClick={() => {
          return null;
        }}
      >
        Update Permissions
      </Button>
    );
  }
}

decorate(AccountCard, {
  handleDetailsExpanded: action,
  handleSelected: action,
  handleBudgetButton: action,
  account: computed,
  detailsExpanded: observable,
  isSelectable: computed,
  isSelected: observable,
  needsUpdate: computed,
});

export default observer(AccountCard);
