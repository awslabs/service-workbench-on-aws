import React from 'react';
import { decorate, computed, action, observable, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button, Modal } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';

import ScEnvironmentConnections from './ScEnvironmentConnections';
import ScEnvironmentUpdateCidrs from './ScEnvironmentUpdateCidrs';

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

  handleTerminate = async () => {
    await this.handleAction(async () => {
      const store = this.envsStore;
      await store.terminateScEnvironment(this.environment.id);
    });
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

  render() {
    const env = this.environment;
    const state = env.state;
    const processing = this.processing;
    const showDetailButton = this.props.showDetailButton;
    const connectionsButtonActive = this.connectionsButtonActive;
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

          {canConnect && (
            <Button
              floated="left"
              basic
              size="mini"
              className="mt1 mb1"
              toggle
              active={connectionsButtonActive}
              onClick={this.handleToggle}
            >
              Connections
            </Button>
          )}
          {showDetailButton && (
            <Button floated="left" basic size="mini" className="mt1 mb1 ml2" onClick={this.handleViewDetail}>
              View Detail
            </Button>
          )}
          {state.canTerminate && !state.key.includes('FAILED') && (
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
        </div>
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
  editCidrButtonActive: observable,
  handleViewDetail: action,
  handleAction: action,
  handleToggle: action,
  handleCidrEditToggle: action,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentButtons)));
