import React from 'react';
import { decorate, computed, action, observable, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button, Modal } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import ScEnvironmentConnections from './ScEnvironmentConnections';
import ScEnvironmentUpdateCidrs from './ScEnvironmentUpdateCidrs';
import { enableEgressStore, isAppStreamEnabled } from '../../../helpers/settings';
import ScEnvironmentEgressStoreDetail from './ScEnvironmentEgressStoreDetail';

const PROCESSING_STATUS_CODE = 'PROCESSING';
const WORKSPACE_TERMINATION_ERROR_MESSAGE =
  'Termination is NOT allowed. Your data transfer from egress store is still in progress. Please contact your Data Manager to confirm the data is transferred before you try to terminate the workspace again.';

// expected props
// - scEnvironment (via prop)
// - showDetailButton (via prop)
// - scEnvironmentsStore (via injection)
class ScEnvironmentButtons extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // A flag to indicate if we are processing the call to trigger the terminate action
      this.processing = false;
      // A flag to indicate if the connections button is active
      this.connectionsButtonActive = false;
      // A flag to indicate if the cidr edit button is active
      this.editCidrButtonActive = false;
      // A flag to indicate if the egressStore button is active
      this.egressStoreButtonActive = false;
    });
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  handleViewDetail = () => {
    const goto = gotoFn(this);
    goto(`/workspaces/id/${this.environment.id}`);
  };

  getEgressStoreDetailsStore = () => {
    if (enableEgressStore) return this.props.scEnvironmentEgressStoreDetailStore;
    return null;
  };

  handleTerminate = async () => {
    if (enableEgressStore) {
      const egressStoreDetailsStore = this.getEgressStoreDetailsStore();
      if (!egressStoreDetailsStore) {
        await this.handleAction(async () => {
          const store = this.envsStore;
          await store.terminateScEnvironment(this.environment.id);
        });
      } else {
        const isDataEgressing =
          egressStoreDetailsStore.egressStoreStatus.toLowerCase() === PROCESSING_STATUS_CODE.toLowerCase();
        if (!isDataEgressing) {
          await this.handleAction(async () => {
            const store = this.envsStore;
            await store.terminateScEnvironment(this.environment.id);
          });
        } else {
          // Do not allow user to terminate workspace if the data egressing is in process
          displayError(WORKSPACE_TERMINATION_ERROR_MESSAGE);
        }
      }
    } else {
      await this.handleAction(async () => {
        const store = this.envsStore;
        await store.terminateScEnvironment(this.environment.id);
      });
    }
  };

  handleStop = async () => {
    await this.handleAction(async () => {
      const store = this.envsStore;
      await store.stopScEnvironment(this.environment.id);
    });
  };

  handleStart = async () => {
    await this.handleAction(async () => {
      const store = this.envsStore;
      await store.startScEnvironment(this.environment.id);
    });
  };

  canChangeState() {
    return this.envsStore.canChangeState(this.environment.id);
  }

  handleAction = async fn => {
    this.processing = true;
    try {
      await fn();
    } catch (error) {
      displayError(error);
    } finally {
      runInAction(() => {
        this.processing = false;
      });
    }
  };

  handleToggle = () => {
    this.connectionsButtonActive = !this.connectionsButtonActive;
  };

  handleCidrEditToggle = () => {
    this.editCidrButtonActive = !this.editCidrButtonActive;
  };

  handleEgressStoreToggle = () => {
    this.egressStoreButtonActive = !this.egressStoreButtonActive;
  };

  render() {
    const env = this.environment;
    const state = env.state;
    const processing = this.processing;
    const showDetailButton = this.props.showDetailButton;
    const connectionsButtonActive = this.connectionsButtonActive;
    const egressStoreButtonActive = this.egressStoreButtonActive;
    const editCidrButtonActive = this.editCidrButtonActive;
    const canConnect = state.canConnect;
    const canStart = state.canStart && this.canChangeState();
    const canStop = state.canStop && this.canChangeState();

    return (
      <>
        <div className="clearfix" style={{ minHeight: '42px' }}>
          {state.canTerminate && (
            <Modal
              trigger={
                <Button
                  data-testid="sc-env-terminate"
                  floated="right"
                  basic
                  color="red"
                  size="mini"
                  className="mt1 mb1"
                  loading={processing}
                >
                  Terminate
                </Button>
              }
              header="Are you sure?"
              content="This action can not be reverted."
              actions={[
                'Cancel',
                { key: 'terminate', content: 'Terminate', negative: true, onClick: this.handleTerminate },
              ]}
              size="mini"
            />
          )}
          {canStart && (
            <Button
              data-testid="sc-env-start"
              floated="right"
              basic
              color="green"
              size="mini"
              className="mt1 mb1 ml2"
              onClick={this.handleStart}
              loading={processing}
            >
              Start
            </Button>
          )}
          {canStop && (
            <Button
              data-testid="sc-env-stop"
              floated="right"
              basic
              color="green"
              size="mini"
              className="mt1 mb1 ml2"
              onClick={this.handleStop}
              loading={processing}
            >
              Stop
            </Button>
          )}

          {/* Only let users connect to the environment if either of these conditions is true:
            1. AppStream is not enabled and environment can be connected to
            2. AppStream is enabled, environment is linked to an AppStream-configured account, and environment can be connected to 
          */}
          {canConnect && (!isAppStreamEnabled || env.isAppStreamConfigured) && (
            <Button
              floated="left"
              basic
              size="mini"
              className="mt1 mb1"
              toggle
              active={connectionsButtonActive}
              onClick={this.handleToggle}
              data-testid="sc-environment-connection-button"
            >
              Connections
            </Button>
          )}
          {showDetailButton && (
            <Button floated="left" basic size="mini" className="mt1 mb1 ml2" onClick={this.handleViewDetail}>
              View Detail
            </Button>
          )}
          {!isAppStreamEnabled && state.canTerminate && !state.key.includes('FAILED') && (
            <Button
              floated="left"
              basic
              size="mini"
              className="mt1 mb1 ml2"
              toggle
              active={editCidrButtonActive}
              onClick={this.handleCidrEditToggle}
            >
              Edit CIDRs
            </Button>
          )}
          {enableEgressStore && state.canTerminate && !state.key.includes('FAILED') && (
            <Button
              floated="left"
              basic
              size="mini"
              className="mt1 mb1 ml2"
              toggle
              active={egressStoreButtonActive}
              onClick={this.handleEgressStoreToggle}
            >
              Egress Store
            </Button>
          )}
        </div>
        {enableEgressStore && egressStoreButtonActive && <ScEnvironmentEgressStoreDetail scEnvironment={env} />}
        {canConnect && connectionsButtonActive && <ScEnvironmentConnections scEnvironment={env} />}
        {editCidrButtonActive && <ScEnvironmentUpdateCidrs scEnvironment={env} onCancel={this.handleCidrEditToggle} />}
      </>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentButtons, {
  envsStore: computed,
  environment: computed,
  processing: observable,
  connectionsButtonActive: observable,
  egressStoreButtonActive: observable,
  editCidrButtonActive: observable,
  handleViewDetail: action,
  handleAction: action,
  handleToggle: action,
  handleCidrEditToggle: action,
  handleEgressStoreToggle: action,
});

// eslint-disable-next-line import/no-mutable-exports
const exportable = inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentButtons)));
export default exportable;
