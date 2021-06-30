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
import c from 'classnames';

import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';

const statusDisplay = {
  CURRENT: { color: 'green', display: 'Up-to-Date' },
  NEEDSUPDATE: { color: 'orange', display: 'Needs Update' },
  NEEDSONBOARD: { color: 'purple', display: 'Needs Onboarding' },
  ERROR: { color: 'red', display: 'Error' },
  UNKNOWN: { color: 'grey', display: 'Unknown' },
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

  get isSelectable() {
    return this.props.isSelectable;
  }

  get permissionStatus() {
    // Possible Values: CURRENT, NEEDSUPDATE, NEEDSONBOARD, ERRORED, NOSTACKNAME
    return this.props.permissionStatus;
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

  handleInputCfnStackName = () => {
    return undefined;
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
            {(permissionStatus === 'NEEDSUPDATE' ||
              permissionStatus === 'NEEDSONBOARD' ||
              permissionStatus === 'NOSTACKNAME') &&
              this.renderUpdatePermsButton()}
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
      cfnStackId: 'CloudFormation Stack ID',
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
    const permissionStatus = this.permissionStatus;
    let buttonArgs;
    if (permissionStatus === 'NEEDSUPDATE')
      buttonArgs = { message: 'Update Permissions', color: 'orange', onClick: this.handleUpdateAccountPerms };
    else if (permissionStatus === 'NOSTACKNAME')
      buttonArgs = { message: 'Input Stack Name', color: 'yellow', onClick: this.handleInputCfnStackName };
    else buttonArgs = { message: 'Onboard Account', color: 'purple', onClick: this.handleOnboardAccount };
    // This button is only displayed if permissionStatus is NEEDSUPDATE, NEEDSONBOARD, or NOSTACKNAME
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

export default withRouter(observer(AccountCard));
