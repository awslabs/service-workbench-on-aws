/* eslint-disable react/no-danger */
import _ from 'lodash';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate } from 'mobx';
import { withRouter } from 'react-router-dom';
import TimeAgo from 'react-timeago';
import { Header, Label, Breadcrumb, Container, Progress, Message, Table } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreError, isStoreReady, isStoreLoading } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';

// expected props
// - workflowsStore (via injection)
// - userDisplayName (via injection)
// - location (from react router)
class WorkflowInstanceDetailPage extends React.Component {
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
    const workflowStore = this.getWorkflowStore();
    const version = this.getVersionNumber();
    const instanceId = this.getInstanceId();
    return workflowStore.getInstanceStore(version, instanceId);
  }

  getWorkflowStore() {
    const workflowId = this.getWorkflowId();
    return this.props.workflowsStore.getWorkflowStore(workflowId);
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  getInstanceId() {
    return (this.props.match.params || {}).instanceId;
  }

  getWorkflowId() {
    return (this.props.match.params || {}).workflowId;
  }

  getVersionNumber() {
    return parseInt((this.props.match.params || {}).version, 10);
  }

  getWorkflow() {
    const store = this.getWorkflowStore();
    if (!isStoreReady(store)) return {};
    return store.workflow;
  }

  getVersion() {
    const workflow = this.getWorkflow();
    const num = this.getVersionNumber();

    return workflow.getVersion(num);
  }

  getInstance() {
    const instanceId = this.getInstanceId();
    const workflowVersion = this.getVersion();
    return workflowVersion.getInstance(instanceId);
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
    const workflowId = this.getWorkflowId();
    const versionNumber = this.getVersionNumber();
    const instanceId = this.getInstanceId();
    const goto = gotoFn(this);

    return (
      <Breadcrumb className="block mb3">
        <Breadcrumb.Section link onClick={() => goto('/workflows/published')}>
          Workflows
        </Breadcrumb.Section>
        <Breadcrumb.Divider icon="right angle" />
        <Breadcrumb.Section link onClick={() => goto(`/workflows/published/id/${workflowId}/v/${versionNumber}`)}>
          {workflowId}
        </Breadcrumb.Section>
        <Breadcrumb.Divider icon="right angle" />
        <Breadcrumb.Section active>{instanceId}</Breadcrumb.Section>
      </Breadcrumb>
    );
  }

  renderMain() {
    const version = this.getVersion();
    const instance = this.getInstance();
    const { id, title, descHtml } = version;
    const { updatedAt, updatedBy } = instance;
    const { statusMsg, statusLabel, statusColor, msgSpread } = instance.statusSummary;
    const displayNameService = this.getUserDisplayNameService();
    const isSystem = displayNameService.isSystem(updatedBy);
    const by = () => (isSystem ? '' : <span className="ml1">by {displayNameService.getDisplayName(updatedBy)}</span>);

    return (
      <>
        <div className="flex mb2">
          <Header as="h3" color="grey" className="mt0 flex-auto ellipsis">
            <Label color={statusColor} className="ml0 mr1">
              {statusLabel}
            </Label>
            <Label color="blue" className="ml0 mr1">
              Workflow Instance
            </Label>
            {title} - {instance.id}
            <Header.Subheader className="fs-9 color-grey mt1">
              <div>
                updated <TimeAgo date={updatedAt} /> {by()}
              </div>
            </Header.Subheader>
          </Header>
          <div className="ml1">
            <span className="ellipsis pr1 fs-9 breakout color-grey">{id}</span>
            <span className="fs-9 color-grey">{version.v}</span>
          </div>
        </div>
        <div className="mb3">
          <div dangerouslySetInnerHTML={{ __html: descHtml }} />
        </div>
        {this.displayInstanceStatusMsg(statusMsg, msgSpread)}
        <Progress percent={100} size="tiny" color={statusColor} />
        {this.renderSteps(instance.steps)}
      </>
    );
  }

  displayInstanceStatusMsg(msg, msgSpread) {
    if (!msg) return null;
    return <Message {...msgSpread}>{msg}</Message>;
  }

  renderSteps(steps) {
    if (_.isEmpty(steps)) return 'This workflow instance does not have any steps';

    return (
      <Table basic="very" celled striped stackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Step</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {_.map(steps, (step, index) => (
            <Table.Row key={index}>
              <Table.Cell textAlign="left" className="fs-9">
                <div>
                  <span className="mr2 bold">{index + 1}</span> {step.title}
                </div>
                {step.statusMsg && (
                  <div className={`color-${step.statusColor || 'grey'} breakout ml3 mt2`}>{step.statusMsg}</div>
                )}
              </Table.Cell>
              <Table.Cell collapsing textAlign="center" className="fs-9">
                <Label size="tiny" color={step.statusColor}>
                  {step.statusLabel}
                </Label>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowInstanceDetailPage, {});

export default inject('workflowsStore', 'userDisplayName')(withRouter(observer(WorkflowInstanceDetailPage)));
