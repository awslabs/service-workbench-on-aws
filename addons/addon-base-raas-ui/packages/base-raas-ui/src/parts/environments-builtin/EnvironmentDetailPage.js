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
import { observer, inject, Observer } from 'mobx-react';
import { decorate, observable, action, runInAction } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import {
  Accordion,
  Breadcrumb,
  Button,
  Container,
  Dropdown,
  Header,
  Icon,
  Label,
  Popup,
  Reveal,
  Segment,
  Tab,
  Table,
} from 'semantic-ui-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import NodeRSA from 'node-rsa';

import { gotoFn } from '@amzn/base-ui/dist/helpers/routing';
import { swallowError } from '@amzn/base-ui/dist/helpers/utils';
import { displayError } from '@amzn/base-ui/dist/helpers/notification';
import { isStoreLoading, isStoreReady, isStoreError } from '@amzn/base-ui/dist/models/BaseStore';
import ErrorBox from '@amzn/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@amzn/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import EnvironmentStatusIcon from './EnvironmentStatusIcon';
import By from '../helpers/By';
import EnvironmentConnectButton from './EnvironmentConnectButton';

const ErrorInfo = ({ environment }) => {
  const [visible, setVisible] = React.useState(() => false);
  // if (!environment.error) {
  //   environment.getEnvironmentError();
  // }

  return (
    <Segment>
      This research workspace encountered an {environment.error ? 'error' : 'unknown error'}.
      {environment.error ? (
        <Accordion>
          <Accordion.Title active={visible} index={0} onClick={() => setVisible(s => !s)}>
            <Icon name="dropdown" />
            Detailed error information
          </Accordion.Title>
          <Accordion.Content active={visible}>
            <p>{environment.error}</p>
          </Accordion.Content>
        </Accordion>
      ) : null}
    </Segment>
  );
};

// expected props
// - environmentsStore (via injection)
// - userStore (via injection)
// - location (from react router)
class EnvironmentDetailPage extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.updateSharedWithUsers = [];
      this.formProcessing = false;
    });
  }

  componentDidMount() {
    const store = this.getInstanceStore();
    swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getInstanceStore();
    store.stopHeartbeat();
  }

  getInstanceStore() {
    const instanceId = this.getInstanceId();
    return this.props.environmentsStore.getEnvironmentStore(instanceId);
  }

  getUserStore() {
    return this.props.userStore;
  }

  getUser() {
    const store = this.getUserStore();
    if (!isStoreReady(store)) return {};
    return store.user;
  }

  getInstanceId() {
    return (this.props.match.params || {}).instanceId;
  }

  getEnvironment() {
    const store = this.getInstanceStore();
    if (!isStoreReady(store)) return {};
    return store.environment;
  }

  render() {
    const store = this.getInstanceStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3">
        {this.renderBreadcrumb()}
        {content}
      </Container>
    );
  }

  renderBreadcrumb() {
    const instanceId = this.getInstanceId();
    const goto = gotoFn(this);

    return (
      <Breadcrumb className="block mb3">
        <Breadcrumb.Section link onClick={() => goto('/workspaces')}>
          Research Workspaces
        </Breadcrumb.Section>
        <Breadcrumb.Divider icon="right angle" />
        <Breadcrumb.Section active>{instanceId}</Breadcrumb.Section>
      </Breadcrumb>
    );
  }

  renderMain() {
    const instance = this.getEnvironment();
    const { id, name, updatedAt, updatedBy } = instance;

    return (
      <>
        <div className="flex mb2">
          <Header as="h3" color="grey" className="mt0 flex-auto ellipsis">
            <span className="flex justify-between">
              <div>
                <Label color="blue" className="ml0 mr1">
                  Research Workspace
                </Label>
                {name} - {id}
              </div>
              <div>
                <EnvironmentStatusIcon environment={instance} />
              </div>
            </span>
            <Header.Subheader className="fs-9 color-grey mt1">
              <div>
                updated <TimeAgo date={updatedAt} /> <By uid={updatedBy} />
              </div>
            </Header.Subheader>
          </Header>
        </div>
        <div className="mb3">{this.renderTabs()}</div>
      </>
    );
  }

  renderTabs() {
    const environment = this.getEnvironment();
    if (environment.isCompleted) {
      return this.renderCompletedTabs();
    }
    if (environment.isStopped) {
      return this.renderStoppedTabs();
    }
    if (environment.isError) {
      return <ErrorInfo environment={environment} />;
    }
    if (environment.isTerminated) {
      return this.renderTerminateInfo();
    }
    return this.renderPendingInfo();
  }

  renderCostDetailsTabPane() {
    return {
      menuItem: 'Research Workspace Details',
      render: () => (
        <Tab.Pane attached={false}>
          <Observer>{() => this.renderInstanceDetails()}</Observer>
        </Tab.Pane>
      ),
    };
  }

  renderCompletedTabs() {
    const environment = this.getEnvironment();

    const panes = [
      {
        menuItem: 'Security',
        render: () => (
          <Tab.Pane attached={false}>
            <Observer>
              {() => {
                switch (environment.instanceInfo.type) {
                  case 'ec2-rstudio':
                    return this.renderRStudioSecurity();
                  case 'ec2-linux':
                    return this.renderEc2LinuxSecurity();
                  case 'ec2-windows':
                    return this.renderEc2WindowsSecurity();
                  case 'sagemaker':
                    return this.renderSagemakerSecurity();
                  case 'emr':
                    return this.renderEmrSecurity();
                  default:
                    return (
                      <Segment placeholder>
                        <Header icon className="color-grey">
                          <Icon name="hdd" />
                          Security
                        </Header>
                      </Segment>
                    );
                }
              }}
            </Observer>
          </Tab.Pane>
        ),
      },
      this.renderCostDetailsTabPane(),
      this.renderUserShareTabPane(),
    ];

    return <Tab menu={{ secondary: true, pointing: true }} panes={panes} />;
  }

  renderInstanceDetails() {
    return this.renderCostInfo();
  }

  renderCostInfo() {
    return (
      <Segment>
        <h2 className="center"> Daily Costs</h2>
        {this.renderCostTable()}
      </Segment>
    );
  }

  renderUserShareTabPane() {
    const environment = this.getEnvironment();
    const uid = environment.createdBy;
    const sharedWithUsersDropDownOptions = this.props.usersStore.asDropDownOptions().filter(item => {
      return !(item.value === uid);
    });

    return {
      menuItem: 'Sharing',
      render: () => (
        <Tab.Pane attached={false}>
          <Observer>
            {() => {
              return (
                <Segment>
                  <h2 className="center">Share with Users</h2>
                  <Dropdown
                    options={sharedWithUsersDropDownOptions}
                    defaultValue={environment.sharedWithUsers.map(item => item.id)}
                    fluid
                    multiple
                    selection
                    search
                    placeholder="Select other users you want to share this environment"
                    disabled={this.formProcessing}
                    onChange={this.handleSharedWithUsersSelection}
                  />
                  <div className="mb2" />
                  <Button color="blue" disabled={this.formProcessing} onClick={this.handleSubmitSharedWithUsersClick}>
                    Update
                  </Button>
                </Segment>
              );
            }}
          </Observer>
        </Tab.Pane>
      ),
    };
  }

  renderStoppedTabs() {
    const panes = [this.renderUserShareTabPane(), this.renderCostDetailsTabPane()];

    return <Tab menu={{ secondary: true, pointing: true }} panes={panes} />;
  }

  handleSharedWithUsersSelection = (e, { value }) => {
    this.updateSharedWithUsers = value.map(item => JSON.parse(item));
  };

  handleSubmitSharedWithUsersClick = async event => {
    event.preventDefault();
    event.stopPropagation();
    const environment = this.getEnvironment();

    runInAction(() => {
      this.formProcessing = true;
    });

    const updateEnvironment = {
      id: environment.id,
      sharedWithUsers: this.updateSharedWithUsers,
    };

    try {
      await this.props.environmentsStore.updateEnvironment(updateEnvironment);
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(error);
    }
    runInAction(() => {
      this.formProcessing = false;
    });
  };

  renderCostTable() {
    // Convert from mobx obj to normal obj
    const environment = JSON.parse(JSON.stringify(this.getEnvironment()));

    let costHeadings = [];
    const rows = [];
    environment.costs.forEach(costItemGivenADate => {
      const cost = costItemGivenADate.cost;
      const headings = Object.keys(cost);
      costHeadings.push(headings);
      const rowValues = {};
      rowValues.date = costItemGivenADate.startDate;
      let total = 0;
      headings.forEach(heading => {
        const amount = cost[heading].amount;
        rowValues[heading] = amount.toFixed(2);
        total += amount;
      });
      rowValues.total = total.toFixed(2);
      rows.push(rowValues);
    });

    costHeadings = _.flatten(costHeadings);
    costHeadings = _.uniq(costHeadings);

    return (
      <Table celled>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Date</Table.HeaderCell>
            {costHeadings.map(header => {
              return <Table.HeaderCell key={header}>{header}</Table.HeaderCell>;
            })}
            <Table.HeaderCell>Total</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map(row => {
            return (
              <Table.Row key={row.date}>
                <Table.Cell>{row.date}</Table.Cell>
                {costHeadings.map(header => {
                  return <Table.Cell key={row}>${_.get(row, header, 0)}</Table.Cell>;
                })}
                <Table.Cell>${row.total}</Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    );
  }

  renderTerminateInfo() {
    const environment = this.getEnvironment();
    return (
      <>
        <Segment>
          This research workspace was terminated <TimeAgo date={environment.updatedAt} />{' '}
          <By uid={environment.updatedBy} />.
        </Segment>
        {this.renderCostInfo()}
      </>
    );
  }

  renderPendingInfo() {
    const environment = this.getEnvironment();
    return (
      <>
        <Segment>
          This research workspace was started <TimeAgo date={environment.createdAt} />{' '}
          <By uid={environment.createdBy} />.
        </Segment>
      </>
    );
  }

  renderCopyToClipboard(text) {
    return (
      <Popup
        content="Copy"
        trigger={
          // <CopyToClipboard text={text} style={{ 'margin-left': '4px', cursor: 'pointer' }}>
          <CopyToClipboard className="ml1 mr0" text={text} style={{ cursor: 'pointer' }}>
            <Icon name="copy" />
          </CopyToClipboard>
        }
      />
    );
  }

  handleKeyPairRequest = async event => {
    event.preventDefault();
    event.stopPropagation();

    const environment = this.getEnvironment();
    const keyPair = await environment.getKeyPair();

    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', `data:application/octet-stream,${encodeURIComponent(keyPair.privateKey)}`);
    downloadLink.setAttribute('download', `${environment.id}.pem`);
    downloadLink.click();
  };

  handleWindowsPasswordRequest = async event => {
    event.preventDefault();
    runInAction(() => {
      this.windowsPassword = 'loading';
    });

    const environment = this.getEnvironment();
    const [{ privateKey }, { passwordData }] = await environment.getWindowsPassword();

    const keyRSA = new NodeRSA(privateKey, 'private', {
      environment: 'browser',
      encryptionScheme: 'pkcs1',
    });
    const password = keyRSA.decrypt(Buffer.from(passwordData, 'base64'), 'buffer').toString('utf8');

    runInAction(() => {
      this.windowsPassword = password;
    });
  };

  renderEc2LinuxSecurity() {
    const environment = this.getEnvironment();
    return (
      <div>
        You&apos;ll need two pieces of information to connect to this research workspace.
        <ol>
          <li>
            The IP Address or DNS of the instance, for this research workspace it is{' '}
            {environment.instanceInfo.Ec2WorkspaceDnsName}
          </li>
          <li>The ssh key</li>
        </ol>
        Connecting to your research workspace depends on the operating system you are connecting from.
        <ul>
          <li>
            <a href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/putty.html">
              Connecting from Windows via Putty
            </a>
          </li>
          <li>
            <a href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AccessingInstancesLinux.html">
              Connecting from MacOS or Linux via SSH
            </a>
          </li>
        </ul>
        Example:
        <Segment>{`ssh -i ${environment.id}.pem ec2-user@${environment.instanceInfo.Ec2WorkspaceDnsName}`}</Segment>
        <Button color="blue" onClick={this.handleKeyPairRequest}>
          Download SSH Key
        </Button>
      </div>
    );
  }

  renderEc2WindowsSecurity() {
    const environment = this.getEnvironment();
    const passRevealDisabled = !this.windowsPassword || this.windowsPassword === 'loading';
    const passRevealStyle = {
      width: '27em',
      height: '5em',
    };

    return (
      <>
        <p>
          Your Windows workspace can be accessed via an RDP client by using the DNS host name and credentials defined
          defined below.
        </p>

        <Label className="mx1">
          Host <Label.Detail>{environment.instanceInfo.Ec2WorkspaceDnsName}</Label.Detail>
          {this.renderCopyToClipboard(environment.instanceInfo.Ec2WorkspaceDnsName)}
        </Label>

        <Reveal className="mt1" animated="move" disabled={passRevealDisabled}>
          <Reveal.Content visible>
            <Button
              color="blue"
              onClick={this.handleWindowsPasswordRequest}
              loading={this.windowsPassword === 'loading'}
              style={passRevealStyle}
            >
              <Icon name={passRevealDisabled ? 'lock' : 'unlock'} />
              {passRevealDisabled ? 'Get ' : 'Show '} Windows Credentials
            </Button>
          </Reveal.Content>
          <Reveal.Content hidden>
            <Segment className="px1 py1" style={passRevealStyle}>
              <Label>
                Username <Label.Detail>Administrator</Label.Detail>
              </Label>
              <br />
              <Label className="mx0">
                Password
                <Label.Detail>{this.windowsPassword}</Label.Detail>
                {this.renderCopyToClipboard(this.windowsPassword)}
              </Label>
            </Segment>
          </Reveal.Content>
        </Reveal>

        <p className="mt2">
          Additional information about connecting via RDP can be found in the documentation below:
          <ul>
            <li>
              <a
                href="https://docs.aws.amazon.com/AWSEC2/latest/WindowsGuide/connecting_to_windows_instance.html#connect-rdp"
                target="_blank"
                rel="noopener noreferrer"
              >
                Connect to Your Windows Instance
              </a>
            </li>
          </ul>
        </p>
      </>
    );
  }

  renderRStudioSecurity() {
    return this.renderConnectBtn('To connect to this RStudio Server instance simply click the launch button below.');
  }

  renderEmrSecurity() {
    return this.renderConnectBtn(
      'To connect to this EMR Jupyter notebook instance simply click the launch button below.',
    );
  }

  renderSagemakerSecurity() {
    return this.renderConnectBtn(
      'To connect to this SageMaker notebook instance simply click the launch button below.',
    );
  }

  renderConnectBtn(msg) {
    const environment = this.getEnvironment();

    return (
      <div>
        <p>{msg}</p>
        <EnvironmentConnectButton as={Button} environment={environment} color="green">
          {environment.fetchingUrl ? (
            <>
              Connecting
              <Icon loading name="spinner" size="small" className="ml1 mr1" />
            </>
          ) : (
            <>Connect</>
          )}
        </EnvironmentConnectButton>
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(EnvironmentDetailPage, {
  windowsPassword: observable,
  updateSharedWithUsers: observable,
  formProcessing: observable,
  handleSharedWithUsersSelection: action,
});

export default inject('environmentsStore', 'userStore', 'usersStore')(withRouter(observer(EnvironmentDetailPage)));
