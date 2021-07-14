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
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Header, Segment, Accordion, Icon, Label, Table, Button } from 'semantic-ui-react';
import c from 'classnames';

import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';

const statusDisplay = {
  CURRENT: { color: 'green', display: 'Up-to-Date', spinner: false },
  NEEDSUPDATE: { color: 'orange', display: 'Needs Update', spinner: false },
  NEEDSONBOARD: { color: 'purple', display: 'Needs Onboarding', spinner: false },
  ERRORED: { color: 'red', display: 'Error', spinner: false },
  PENDING: { color: 'yellow', display: 'Pending', spinner: true },
  UNKNOWN: { color: 'grey', display: 'Unknown', spinner: false },
};

// expected props
// - id (via props)
// - account (via props)
// - permissionStatus (via props)
// - isSelectable (via props) (currently unused)
class AccountCard extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.detailsExpanded = false;
      this.isSelected = false;
    });
  }

  get account() {
    return this.props.account;
  }

  get awsAccountsStore() {
    return this.props.awsAccountsStore;
  }

  get isSelectable() {
    return this.props.isSelectable;
  }

  get permissionStatus() {
    // Possible Values: CURRENT, NEEDSUPDATE, NEEDSONBOARD, ERRORED, NOSTACKNAME
    return this.account.permissionStatus;
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

  handleOnboardAccount = () => {
    const awsAccountId = this.account.id;
    this.goto(`/aws-accounts/onboard/${awsAccountId}`);
  };

  handleUpdateAccountPerms = () => {
    const awsAccountId = this.account.id;
    this.goto(`/aws-accounts/onboard/${awsAccountId}`);
  };

  handlePendingButton = () => {
    // const accountsStore = this.awsAccountsStore;
    // const accountId = this.account.id;
    // accountsStore.resetPendingAccount(accountId);
    const awsAccountId = this.account.id;
    this.goto(`/aws-accounts/onboard/${awsAccountId}`);
  };

  render() {
    const isSelectable = this.isSelectable; // Internal and external guests can't select studies
    const account = this.account;
    const attrs = {};
    const onClickAttr = {};
    const permissionStatus = this.permissionStatus;

    if (this.isSelected) attrs.color = 'blue';
    if (isSelectable) onClickAttr.onClick = () => this.handleSelected();

    return (
      <Segment clearing padded raised className="mb3" {...attrs}>
        <div className="flex">
          <div className="flex-auto mb1">
            {this.renderStatus(permissionStatus)}
            {this.renderBudgetButton()}
            {this.renderHeader(account)}
            {this.renderDescription(account)}
            {permissionStatus !== 'CURRENT' && this.renderUpdatePermsButton()}
            {!(permissionStatus === 'NEEDSONBOARD' || permissionStatus === 'PENDING') &&
              this.renderDetailsAccordion(account)}
            {(permissionStatus === 'NEEDSONBOARD' || permissionStatus === 'PENDING') &&
              this.renderPendingDetailsAccordion(account)}
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
    return (
      <div>
        <Header as="h3" color="blue" className={c('mt2', isSelectable ? 'cursor-pointer' : '')} {...onClickAttr}>
          {account.name}
          <Header.Subheader>
            <span className="pt1 fs-8 color-grey">AWS Account #{idReadable}</span>
          </Header.Subheader>
        </Header>
      </div>
    );
  }

  renderDescription(account) {
    return <div>{account.description}</div>;
  }

  renderStatus(status) {
    const state = statusDisplay[status] || statusDisplay.UNKNOWN;
    return (
      <Label attached="top left" size="mini" color={state.color}>
        {state.spinner && <Icon name="spinner" loading />}
        {state.display}
      </Label>
    );
  }

  renderPendingDetailsAccordion(account) {
    const expanded = this.detailsExpanded;
    const onboardMessage = account.permissionStatus === 'NEEDSONBOARD';
    return (
      <Accordion className="mt2">
        <Accordion.Title active={expanded} index={0} onClick={this.handleDetailsExpanded}>
          <Icon name="dropdown" />
          <b>Details</b>
        </Accordion.Title>
        <Accordion.Content active={expanded}>
          {expanded && (
            <div className="mb2">
              {onboardMessage && (
                <div>This account needs to be onboarded. Click &quot;Onboard Account&quot; to finish setting up.</div>
              )}
              {!onboardMessage && (
                <div>
                  Service Workbench is waiting for the CFN stack to complete. Please wait a few minutes for provisioning
                  to complete. If you did not create a CFN stack for this account, click click &quot;Re-Onboard
                  Account&quot; to return to the account onboarding page.
                </div>
              )}
            </div>
          )}
        </Accordion.Content>
      </Accordion>
    );
  }

  renderDetailsAccordion(account) {
    const expanded = this.detailsExpanded;
    const errored = account.permissionStatus === 'ERRORED';
    const rowKeyVal = {
      roleArn: 'Role ARN',
      externalId: 'External ID',
      vpcId: 'VPC ID',
      subnetId: 'Subnet ID',
      encryptionKeyArn: 'Encryption Key ARN',
      cfnStackId: 'CloudFormation Stack ID',
    };

    return (
      <Accordion className="mt2">
        <Accordion.Title active={expanded} index={0} onClick={this.handleDetailsExpanded}>
          <Icon name="dropdown" />
          <b>Details</b>
        </Accordion.Title>
        <Accordion.Content active={expanded}>
          {expanded && errored && (
            <div className="mb2">
              Something went wrong while trying to check the CFN stack associated with this account. Please check the
              CFN stack in the AWS Management Console for more information.
            </div>
          )}
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
    const permissionStatus = this.permissionStatus;
    let buttonArgs;
    if (permissionStatus === 'NEEDSUPDATE' || permissionStatus === 'ERRORED' || permissionStatus === 'UNKNOWN')
      buttonArgs = { message: 'Update Permissions', color: 'orange', onClick: this.handleUpdateAccountPerms };
    else if (permissionStatus === 'PENDING')
      buttonArgs = { message: 'Re-Onboard Account', color: 'red', onClick: this.handlePendingButton };
    else buttonArgs = { message: 'Onboard Account', color: 'purple', onClick: this.handleOnboardAccount };
    // This button is only displayed if permissionStatus is NEEDSUPDATE, NEEDSONBOARD, or PENDING
    return (
      <Button floated="right" color={buttonArgs.color} onClick={buttonArgs.onClick}>
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
  permissionStatus: computed,
});

export default inject('awsAccountsStore')(withRouter(observer(AccountCard)));
