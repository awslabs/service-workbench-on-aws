import React from 'react';
import _ from 'lodash';
import { observer, inject } from 'mobx-react';
import { decorate, runInAction } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Icon, Label, Image } from 'semantic-ui-react';
import Dotdotdot from 'react-dotdotdot';

import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { storage } from '@aws-ee/base-ui/dist/helpers/utils';

import EnvironmentStatusIcon from './EnvironmentStatusIcon';
import By from '../helpers/By';
import EnvironmentConnectButton from './EnvironmentConnectButton';
import localStorageKeys from '../../models/constants/local-storage-keys';
import sagemakerNotebookIcon from '../../../images/marketplace/sagemaker-notebook-icon.svg';
import emrIcon from '../../../images/marketplace/emr-icon.svg';
import ec2Icon from '../../../images/marketplace/ec2-icon.svg';

const UPDATE_INTERVAL_MS = 20000;

// expected props
// - environment - a Environment model instance (via props)
// - userDisplayName (via injection)
// - location (from react router)
class EnvironmentCard extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // add any state changing initialization logic if needed
    });
  }

  componentDidMount() {
    const environment = this.getEnvironment();

    environment.setFetchingUrl(false);
    if (environment.isExternal && environment.isPending && this.props.user.isExternalUser) {
      // TODO abstract this workflow to be used elsewhere
      // Call checkExternalUpdate every minute
      this.intervalId = setInterval(this.checkExternalUpdate, UPDATE_INTERVAL_MS, environment, this.props.user);
    }
  }

  componentWillUnmount() {
    clearInterval(this.intervalId);
  }

  checkExternalUpdate = (environment, user) => {
    const pin = storage.getItem(localStorageKeys.pinToken);
    // Confirm if the stack still needs to be checked
    if (!(environment.isExternal && environment.isPending && user.isExternalUser)) {
      clearInterval(this.intervalId);
      return;
    }
    if (!_.isEmpty(pin)) {
      this.getStore().updateExternalEnvironment(environment, user, pin);
    }
  };

  handleTerminateEnvironment = async event => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const store = this.getStore();
      await store.deleteEnvironment(this.getEnvironment(), this.props.user, storage.getItem(localStorageKeys.pinToken));
    } catch (error) {
      displayError(error);
    }
  };

  getEnvironment() {
    return this.props.environment;
  }

  getStore() {
    return this.props.environmentsStore;
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  getIcon(type) {
    switch (type) {
      case 'sagemaker':
        return sagemakerNotebookIcon;
      case 'emr':
        return emrIcon;
      case 'ec2-linux':
      case 'ec2-windows':
        return ec2Icon;
      default:
        return null;
    }
  }

  render() {
    const item = this.getEnvironment();
    return (
      <div className="flex">
        {this.renderLeftCard(item)}
        {this.renderRightCard(item)}
      </div>
    );
  }

  renderLeftCard(env) {
    const { name, description, createdAt, createdBy, fetchingUrl, status, instanceInfo } = env;
    return (
      <div className="flex-auto">
        <div className="flex">
          <Image
            src={this.getIcon(instanceInfo.type)}
            className="mt0 mr1"
            style={{ maxHeight: '24px', maxWidth: '24px' }}
          />
          <Header as="h3" color="grey" className="mt0 flex-auto">
            {name}
          </Header>
          <div className="flex">
            <Label className="flex-auto basic" style={{ border: 0 }}>
              {status === 'COMPLETED' && (instanceInfo.type === 'sagemaker' || instanceInfo.type === 'emr') && (
                <EnvironmentConnectButton as={Label} user={this.props.user} environment={env} size="mini" color="green">
                  {fetchingUrl ? (
                    <>
                      Connecting
                      <Icon loading name="spinner" size="small" className="ml1 mr1" />
                    </>
                  ) : (
                    <>Connect</>
                  )}
                </EnvironmentConnectButton>
              )}
            </Label>
            <Label className="flex-auto basic" style={{ border: 0 }}>
              <EnvironmentStatusIcon environment={env} />
            </Label>
          </div>
        </div>
        <div className="ml3 mb2 mt2 breakout">
          created <TimeAgo date={createdAt} /> <By user={createdBy} />
        </div>
        <div className="ml3 mb2 mt2 breakout">
          <Dotdotdot clamp={3}>{description}</Dotdotdot>
        </div>
        <div className="ml3 mb2 mt2 breakout bold">
          Yesterday&apos;s Research Workspace Cost: ${this.getCostInPastDay(env.costs)}
        </div>
      </div>
    );
  }

  getCostInPastDay(costInfo) {
    if (_.isEmpty(costInfo)) {
      return 0;
    }
    const costsForLatestDate = costInfo[costInfo.length - 1].cost;
    let total = 0;
    costsForLatestDate.forEach(service => {
      total += service.amount;
    });
    return total.toFixed(2);
  }

  renderRightCard(environment) {
    const displayNameService = this.getUserDisplayNameService();
    return (
      <div className="border-left border-grey pl2 ml2">
        <div className="mt1 fs-9">
          <span className="bold  inline-block">Research Workspace Owners</span>{' '}
          <Label circular size="mini" color="blue">
            {1}
          </Label>
        </div>
        <div className="fs-9">
          <Dotdotdot clamp={1}>{displayNameService.getLongDisplayName(environment.createdBy)}</Dotdotdot>
        </div>
        <div className="mt3 fs-9">
          <span className="bold  inline-block">Research Workspace Users</span>{' '}
          <Label circular size="mini">
            {0}
          </Label>
        </div>
        <div className="fs-9">
          <Dotdotdot clamp={1}>{[]}</Dotdotdot>
        </div>

        <div className="mt3 fs-9">
          <span className="bold  inline-block">Project</span>{' '}
        </div>
        <div className="fs-9 mb2">
          <Dotdotdot clamp={1}>{environment.projectId}</Dotdotdot>
        </div>
        <div className="mb1 mt5 breakout">{this.renderTerminateButton(environment)}</div>
      </div>
    );
  }

  renderTerminateButton(environment) {
    let terminateButton;
    if (environment.isCompleted) {
      terminateButton = (
        <Label
          color="red"
          className="cursor-pointer"
          data-id={environment.id}
          onClick={this.handleTerminateEnvironment}
        >
          <Icon name="power off" />
          Terminate
        </Label>
      );
    }

    return <>{terminateButton}</>;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(EnvironmentCard, {});

export default inject('userDisplayName')(withRouter(observer(EnvironmentCard)));
