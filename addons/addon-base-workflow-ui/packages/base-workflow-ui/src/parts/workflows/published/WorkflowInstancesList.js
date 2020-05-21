import _ from 'lodash';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate, action, autorun, runInAction, observable } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Segment, Icon, Statistic, Grid, Label, Button } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { swallowError, niceNumber } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreReady, isStoreLoading, isStoreEmpty } from '@aws-ee/base-ui/dist/models/BaseStore';
import Form from '@aws-ee/base-ui/dist/parts/helpers/fields/Form';
import TextArea from '@aws-ee/base-ui/dist/parts/helpers/fields/TextArea';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import getTriggerWorkflowForm from '../../../models/forms/TriggerWorkflowForm';
import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';

// expected props
// - workflowVersion (via props)
// - workflowsStore (via injection)
// - userDisplayName (via injection)
// - location (from react router)
class WorkflowInstancesList extends React.Component {
  constructor(props) {
    super(props);
    this.form = getTriggerWorkflowForm();
    runInAction(() => {
      this.triggerDialogShown = false;
    });
  }

  componentDidMount() {
    if (this.disposer) this.disposer();

    this.disposer = autorun(() => {
      const store = this.getInstancesStore();
      if (!isStoreReady(store)) swallowError(store.load());
    });

    const store = this.getInstancesStore();
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getInstancesStore();
    store.stopHeartbeat();
    if (this.disposer) this.disposer();
  }

  getWorkflowVersion() {
    return this.props.workflowVersion;
  }

  getWorkflowStore() {
    const workflowVersion = this.getWorkflowVersion();
    return this.props.workflowsStore.getWorkflowStore(workflowVersion.id);
  }

  getInstancesStore() {
    const workflowStore = this.getWorkflowStore();
    const workflowVersion = this.getWorkflowVersion();
    return workflowStore.getInstancesStore(workflowVersion.id, workflowVersion.v);
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  cancelTriggerDialog = () => {
    this.triggerDialogShown = false;
  };

  showTriggerDialog = () => {
    this.triggerDialogShown = true;
  };

  handleFormSubmission = async form => {
    const values = form.values();
    const workflowInputStr = values.workflowInput;

    try {
      const store = this.getInstancesStore();

      // Convert input JSON string to an input object
      const input = JSON.parse(workflowInputStr);
      await store.triggerWorkflow({ input });

      form.clear();
      this.cancelTriggerDialog();
    } catch (error) {
      if (error instanceof SyntaxError) {
        displayError('Incorrect workflow input. Make sure the workflow input is a well-formed JSON.');
      } else {
        displayError(error);
      }
    }
  };

  handleInstanceClick = event => {
    event.preventDefault();
    event.stopPropagation();

    // see https://reactjs.org/docs/events.html and https://github.com/facebook/react/issues/5733
    const instanceId = event.currentTarget.dataset.instance;
    const goto = gotoFn(this);
    const { id, v } = this.getWorkflowVersion();

    goto(`/workflows/published/id/${id}/v/${v}/instances/id/${instanceId}`);
  };

  render() {
    const store = this.getInstancesStore();
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder />;
    } else if (isStoreReady(store) && isStoreEmpty(store)) {
      content = this.renderEmptyInstances();
    } else if (isStoreReady(store) && !isStoreEmpty(store)) {
      content = this.renderMain();
    } else {
      // We get here if the store is in the initial state
      content = null;
    }

    return (
      <>
        {this.renderTriggerDialog()}
        {content}
      </>
    );
  }

  renderMain() {
    const store = this.getInstancesStore();
    const list = store.list;

    return _.map(list, instance => this.renderRow(instance));
  }

  renderRow(instance) {
    const { id, createdAt, createdBy, statusSummary } = instance;
    const displayNameService = this.getUserDisplayNameService();
    const by = () => <span>{displayNameService.getDisplayName(createdBy)}</span>;
    const { statusLabel, statusColor, stepsSummary } = statusSummary;

    return (
      <Segment
        clearing
        padded
        key={id}
        className="mb3 cursor-pointer"
        data-instance={id}
        onClick={this.handleInstanceClick}
      >
        <Grid celled="internally" stackable>
          <Grid.Row stretched>
            <Grid.Column width={3} className="center pr3">
              <Label color={statusColor} className="fluid center mb1">
                {statusLabel}
              </Label>
              <div className="mb1">
                id <b>{id}</b>
              </div>
              <TimeAgo date={createdAt} />
              {by()}
            </Grid.Column>
            <Grid.Column width={13}>
              <div className="mb2 center">Steps</div>
              <Statistic.Group widths="five" size="tiny">
                {_.map(stepsSummary, item => (
                  <Statistic key={item.statusLabel} color={item.statusColor}>
                    <Statistic.Value>{niceNumber(item.count)}</Statistic.Value>
                    <Statistic.Label>{item.statusLabel}</Statistic.Label>
                  </Statistic>
                ))}
              </Statistic.Group>
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Segment>
    );
  }

  renderEmptyInstances() {
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="copy outline" />
          No instances
          <Header.Subheader>
            Once the workflow is triggered at least once, you will start seeing information about the instances in this
            area.
          </Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTriggerDialog() {
    const show = this.triggerDialogShown;

    return (
      <>
        {!show && (
          <div className="clearfix mb2">
            <Button basic color="blue" floated="right" onClick={this.showTriggerDialog}>
              Trigger
            </Button>
          </div>
        )}
        {show && this.renderTriggerDialogContent()}
      </>
    );
  }

  renderTriggerDialogContent() {
    const form = this.form;
    const workflowInputField = form.$('workflowInput');

    return (
      <Segment clearing className="p3 mb3 mt3">
        <Form
          form={form}
          onCancel={this.cancelTriggerDialog}
          onSuccess={this.handleFormSubmission}
          onError={this.handleFormError}
        >
          {({ processing, _onSubmit, onCancel }) => (
            <>
              <TextArea field={workflowInputField} disabled={processing} />
              <div className="mt0">
                <Button floated="right" color="blue" icon disabled={processing} className="ml2" type="submit">
                  Trigger
                </Button>
                <Button floated="right" disabled={processing} onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Form>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowInstancesList, {
  triggerDialogShown: observable,
  handleInstanceClick: action,
  showTriggerDialog: action,
  cancelTriggerDialog: action,
  handleFormSubmission: action,
});

export default inject('workflowsStore', 'userDisplayName')(withRouter(observer(WorkflowInstancesList)));
