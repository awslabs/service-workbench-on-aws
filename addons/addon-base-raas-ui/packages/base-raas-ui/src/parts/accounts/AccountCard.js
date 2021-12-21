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
import { displayWarning } from '@aws-ee/base-ui/dist/helpers/notification';
import { isAppStreamEnabled } from '../../helpers/settings';

const { getAccountIdsOfActiveEnvironments } = require('./AccountUtils');

const statusDisplay = {
  CURRENT: { color: 'green', display: 'Up-to-Date', spinner: false },
  NEEDS_UPDATE: { color: 'orange', display: 'Needs Update', spinner: false },
  NEEDS_ONBOARD: { color: 'purple', display: 'Needs Onboarding', spinner: false },
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
      this.permButtonLoading = false;
    });
  }

  get account() {
    return this.props.account;
  }

  get appStreamStatusMismatch() {
    return isAppStreamEnabled && !this.account.isAppStreamConfigured;
  }

  get awsAccountsStore() {
    return this.props.awsAccountsStore;
  }

  get isSelectable() {
    return this.props.isSelectable;
  }

  get permissionStatus() {
    // Possible Values: CURRENT, NEEDS_UPDATE, NEEDS_ONBOARD, ERRORED
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
    const awsAccountUUID = this.account.id;
    this.goto(`/aws-accounts/budget/${awsAccountUUID}`);
  };

  handleUpdatePermission() {
    const awsAccountUUID = this.account.id;
    // If the account needs to be upgraded to support AppStream we need to Update the account with AppStream specific settings, for example: AppStreamImageName
    if (this.appStreamStatusMismatch) {
      this.goto(`/aws-accounts/update/${awsAccountUUID}/rev/${this.account.rev}`);
    } else {
      this.goto(`/aws-accounts/onboard/${awsAccountUUID}`);
    }
  }

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
            {!(permissionStatus === 'NEEDS_ONBOARD' || permissionStatus === 'PENDING') &&
              this.renderDetailsAccordion(account)}
            {(permissionStatus === 'NEEDS_ONBOARD' || permissionStatus === 'PENDING') &&
              this.renderPendingDetailsAccordion(account)}
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
    const isExpanded = this.detailsExpanded;
    const shouldShowOnboardMessage = account.permissionStatus === 'NEEDS_ONBOARD';
    return (
      <Accordion className="mt2">
        <Accordion.Title active={isExpanded} index={0} onClick={this.handleDetailsExpanded}>
          <Icon name="dropdown" />
          <b>Details</b>
        </Accordion.Title>
        <Accordion.Content active={isExpanded}>
          {isExpanded && (
            <div className="mb2">
              {shouldShowOnboardMessage
                ? "This account needs to be onboarded. Click 'Onboard Account' to finish setting up."
                : `Service Workbench is waiting for the CFN stack to complete. 
                Please wait a few minutes for provisioning to complete. 
                If you did not create a CFN stack for this account, click
                 "Re-Onboard Account" to return to the account onboarding page.`}
            </div>
          )}
        </Accordion.Content>
      </Accordion>
    );
  }

  renderDetailsAccordion(account) {
    const isExpanded = this.detailsExpanded;
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
        <Accordion.Title active={isExpanded} index={0} onClick={this.handleDetailsExpanded}>
          <Icon name="dropdown" />
          <b>Details</b>
        </Accordion.Title>
        <Accordion.Content active={isExpanded}>
          {isExpanded && errored && (
            <div className="mb2">
              Something went wrong while trying to check the CFN stack associated with this account. Please check the
              CFN stack in the AWS Management Console for more information.
            </div>
          )}
          {isExpanded && (
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

  async checkForActiveAccounts() {
    runInAction(() => {
      this.permButtonLoading = true;
    });
    const scEnvironmentStore = this.props.scEnvironmentsStore;
    const indexesStore = this.props.indexesStore;
    const projectsStore = this.props.projectsStore;

    await Promise.all([scEnvironmentStore.doLoad(), indexesStore.doLoad(), projectsStore.doLoad()]);
    const scEnvs = scEnvironmentStore.list;
    const indexes = indexesStore.list;
    const projects = projectsStore.list;

    const accountHasActiveEnv = getAccountIdsOfActiveEnvironments(scEnvs, projects, indexes).includes(
      this.props.account.id,
    );
    runInAction(() => {
      this.permButtonLoading = false;
    });

    if (accountHasActiveEnv) {
      displayWarning('Please terminate all workspaces in this account before upgrading the account');
    } else {
      this.handleUpdatePermission();
    }
  }

  renderUpdatePermsButton() {
    const permissionStatus = this.permissionStatus;
    let buttonArgs;
    if (permissionStatus === 'NEEDS_UPDATE' || permissionStatus === 'ERRORED')
      buttonArgs = {
        message: 'Update Permissions',
        color: 'orange',
      };
    else if (permissionStatus === 'PENDING' || permissionStatus === 'UNKNOWN')
      buttonArgs = {
        message: 'Re-Onboard Account',
        color: 'red',
      };
    else
      buttonArgs = {
        message: 'Onboard Account',
        color: 'purple',
      };

    buttonArgs.onClick = async () => {
      if (this.appStreamStatusMismatch) {
        await this.checkForActiveAccounts();
      } else {
        this.handleUpdatePermission();
      }
    };

    return (
      <Button floated="right" color={buttonArgs.color} onClick={buttonArgs.onClick} loading={this.permButtonLoading}>
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
  permButtonLoading: observable,
});

export default inject(
  'awsAccountsStore',
  'scEnvironmentsStore',
  'indexesStore',
  'projectsStore',
)(withRouter(observer(AccountCard)));
