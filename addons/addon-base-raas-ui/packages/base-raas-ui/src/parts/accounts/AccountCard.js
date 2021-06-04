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
import { withRouter } from 'react-router-dom';
import { Header, Segment, Accordion, Icon, Label, Table, Button } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';
import c from 'classnames';

import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';

// expected props
// - key (via props)
// - account (via props)
// - needsUpdate (via props)
// - isSelectable (via props)
// - location (via props)
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

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  handleDetailsExpanded = () => {
    this.detailsExpanded = !this.detailsExpanded;
  };

  handleSelected = () => {
    this.isSelected = !this.isSelected;
  };

  handleBudgetButton = () => {
    const awsAccountId = this.account.id;
    this.goto(`/aws-accounts/budget/${awsAccountId}`);
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

    // Checkbox will be added to this segment when functionality for edit/delete users is added
    // <div className="mr2" {...onClickAttr}>
    //   {isSelectable && <Checkbox checked={this.isSelected} style={{ marginTop: '31px' }} />}
    // </div>
  }

  renderHeader(account) {
    const isSelectable = this.isSelectable;
    const onClickAttr = {};
    const idReadable = account.accountId.replace(/(.{4})(.{4})/g, '$1-$2-');
    if (isSelectable) onClickAttr.onClick = () => this.handleSelected();
    const timeLastUpdated = this.account.updatedAt; // this defaults to empty string if not found
    const cfnStackName = this.account.cfnStackName;
    return (
      <div>
        <Header as="h3" color="blue" className={c('mt2', isSelectable ? 'cursor-pointer' : '')} {...onClickAttr}>
          {account.name}
          <Header.Subheader>
            <span className="pt1 fs-8 color-grey">AWS Account #{idReadable}</span>
          </Header.Subheader>
          {cfnStackName !== '' && timeLastUpdated !== '' && (
            <Header.Subheader>
              <span className="fs-8 color-grey mr1">
                Permissions checked <TimeAgo date={timeLastUpdated} className="mr1" />
              </span>
            </Header.Subheader>
          )}
          {cfnStackName !== '' && timeLastUpdated === '' && (
            <Header.Subheader>
              <span className="fs-8 color-grey mr1">Error checking last permission update time</span>
            </Header.Subheader>
          )}
        </Header>
      </div>
    );
  }

  renderDescription(account) {
    return <div>{account.description}</div>;
  }

  renderStatus() {
    const needsUpdate = this.needsUpdate;
    const account = this.account;
    const state =
      account.cfnStackName === ''
        ? { color: 'purple', display: 'Needs Onboard' }
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
      <Button floated="right" color="blue" onClick={this.handleBudgetButton}>
        Budget Detail
      </Button>
    );
  }

  renderUpdatePermsButton() {
    const needsUpdate = this.needsUpdate;
    const buttonArgs =
      needsUpdate === true
        ? { message: 'Update Permissions', color: 'orange' }
        : { message: 'Onboard Account', color: 'purple' };
    // This button is only displayed if needsUpdate is either True or undefined
    return (
      <Button
        floated="right"
        color={buttonArgs.color}
        onClick={() => {
          return null;
        }}
      >
        {buttonArgs.message}
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

export default withRouter(observer(AccountCard));
