import React from 'react';
import _ from 'lodash';
import { decorate, computed, runInAction, action, observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Icon, Table, Label, Grid, Button } from 'semantic-ui-react';
import TimeAgo from 'react-timeago';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import UserLabels from '@aws-ee/base-ui/dist/parts/helpers/UserLabels';
import { isStoreReady, isStoreLoading, isStoreError, stopHeartbeat } from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import { Operation } from '../../models/helpers/Operation';
import StudyConnectionPanel from './parts/StudyConnectionPanel';
import StudyStatusMessage from './parts/StudyStatusMessage';

// expected props
// - study (via prop)
// - store (via prop) (this the study store)
// - dataSourceAccountsStore (via injection)
// - usersStore (via injection)
class DataSourceStudyRow extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.expanded = false;
      this.connectionPanel = {
        show: false,
        operation: Operation.create({}),
      };
    });
  }

  componentWillUnmount() {
    const store = this.studyStore;
    stopHeartbeat(store);
  }

  get study() {
    return this.props.study;
  }

  get accountsStore() {
    return this.props.dataSourceAccountsStore;
  }

  get usersStore() {
    return this.props.usersStore;
  }

  get studyStore() {
    return this.props.store;
  }

  handleExpandClick = event => {
    event.preventDefault();
    event.stopPropagation();
    this.expanded = !this.expanded;
    const store = this.studyStore;

    if (!isStoreReady(store) && this.expanded) {
      swallowError(store.load());
      store.startHeartbeat();
    }

    if (!this.expanded) {
      stopHeartbeat(store);
    }
  };

  handleCheckConnection = () => {
    this.connectionPanel.show = true;

    const study = this.study;
    const accountsStore = this.accountsStore;
    const operation = this.connectionPanel.operation;
    const doWork = async () => {
      await accountsStore.checkStudyReachability(study.id);
    };

    swallowError(operation.run(doWork));
  };

  handleDismissPanel = () => {
    this.connectionPanel.show = false;
  };

  render() {
    const expanded = this.expanded;
    const item = this.study;
    const { id, category, folder, friendlyAccessType, state } = item;
    const value = text => <span>{_.isEmpty(text) ? 'Not Provided' : text}</span>;
    const iconName = expanded ? 'angle down' : 'angle right';

    return (
      <>
        <Table.Row className="cursor-pointer" onClick={this.handleExpandClick}>
          <Table.Cell collapsing>
            <Icon name={iconName} />
          </Table.Cell>
          <Table.Cell className="breakout">{value(id)}</Table.Cell>
          <Table.Cell className="breakout">{value(folder)}</Table.Cell>
          <Table.Cell className="nowrap">{value(category)}</Table.Cell>
          <Table.Cell className="nowrap">{value(friendlyAccessType)}</Table.Cell>
          <Table.Cell>{this.renderStatus(state)}</Table.Cell>
        </Table.Row>
        {expanded && (
          <Table.Row className="animated fadeIn">
            <Table.Cell colSpan="6">{this.renderExpanded()}</Table.Cell>
          </Table.Row>
        )}
      </>
    );
  }

  renderStatus(state, classnames) {
    return (
      <div className={classnames}>
        <Label size="mini" color={state.color}>
          {state.display}
        </Label>
      </div>
    );
  }

  renderExpanded() {
    const store = this.studyStore;
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} />;
    } else {
      content = this.renderExpandedContent();
    }

    return content;
  }

  renderExpandedContent() {
    const study = this.study;
    const operation = this.connectionPanel.operation;
    const showPanel = this.connectionPanel.show;

    return (
      <div className="mb2 animated fadeIn">
        <div className="clearfix">
          <Button size="mini" floated="right" basic color="brown" onClick={this.handleCheckConnection}>
            Test Connection
          </Button>
        </div>
        {!study.reachableState && !showPanel && <StudyStatusMessage study={study} />}
        {showPanel && <StudyConnectionPanel study={study} operation={operation} onCancel={this.handleDismissPanel} />}
        <div className="p1" style={{ height: '1px' }} />
        <Grid stackable columns={2} className="block">
          <Grid.Column>{this.renderDetailTablePart1()}</Grid.Column>
          <Grid.Column>{this.renderDetailTablePart2()}</Grid.Column>
        </Grid>
        {this.renderDetailTablePart3()}
        {this.renderPermissionsTable()}
      </div>
    );
  }

  renderDetailTablePart1() {
    const store = this.studyStore;
    const study = store.study;
    const { id, name, state, statusAt, folder } = study;
    const naIfEmpty = value => (_.isEmpty(value) ? 'N/A' : value);
    const renderRow = (key, value) => (
      <Table.Row>
        <Table.Cell width={2} className="nowrap">
          {key}
        </Table.Cell>
        <Table.Cell width={14} className="breakout">
          {value}
        </Table.Cell>
      </Table.Row>
    );

    return (
      <Table definition>
        <Table.Body>
          <Table.Row>
            <Table.Cell width={2} className="nowrap">
              Status
            </Table.Cell>
            <Table.Cell width={16} className="flex">
              {this.renderStatus(state, 'flex-auto mr1')}
              <span className="fs-8 color-grey mr1">
                Status checked <TimeAgo date={statusAt} className="color-grey fs-8" />
              </span>
            </Table.Cell>
          </Table.Row>

          {renderRow('ID', id)}
          {renderRow('Name', naIfEmpty(name))}
          {renderRow('Path', folder)}
        </Table.Body>
      </Table>
    );
  }

  renderDetailTablePart2() {
    const store = this.studyStore;
    const study = store.study;
    const { category, friendlyAccessType, bucket, projectId, region } = study;
    const naIfEmpty = value => (_.isEmpty(value) ? 'N/A' : value);
    const renderRow = (key, value) => (
      <Table.Row>
        <Table.Cell width={2} className="nowrap">
          {key}
        </Table.Cell>
        <Table.Cell width={14} className="breakout">
          {value}
        </Table.Cell>
      </Table.Row>
    );
    const bucketRow = (
      <Table.Row>
        <Table.Cell width={2} className="nowrap">
          Bucket
        </Table.Cell>
        <Table.Cell width={16} className="breakout flex">
          <div className="breakout flex-auto mr1">{bucket}</div>
          <div className="fs-9 color-grey nowrap">{region}</div>
        </Table.Cell>
      </Table.Row>
    );

    return (
      <Table definition>
        <Table.Body>
          {renderRow('Project', naIfEmpty(projectId))}
          {renderRow('Type', category)}
          {renderRow('Access', friendlyAccessType)}
          {bucketRow}
        </Table.Body>
      </Table>
    );
  }

  renderDetailTablePart3() {
    const store = this.studyStore;
    const study = store.study;
    const { description, kmsScope, kmsArn } = study;
    const naIfEmpty = value => (_.isEmpty(value) ? 'None' : value);
    const kms = kmsScope === 'bucket' ? 'Use bucket default encryption' : kmsArn;
    const renderRow = (key, value) => (
      <Table.Row>
        <Table.Cell width={2} className="nowrap">
          {key}
        </Table.Cell>
        <Table.Cell width={14} className="breakout">
          {value}
        </Table.Cell>
      </Table.Row>
    );

    return (
      <Table definition>
        <Table.Body>
          {renderRow('KMS Arn', naIfEmpty(kms))}
          {renderRow('Description', naIfEmpty(description))}
        </Table.Body>
      </Table>
    );
  }

  renderPermissionsTable() {
    const store = this.studyStore;
    const study = store.study;
    const { accessType, myStudies } = study;
    const { adminUsers = [], readonlyUsers = [], readwriteUsers = [] } = study.permissions || {};
    const showReadonly = accessType === 'readonly' || accessType === 'readwrite';
    const showReadwrite = accessType === 'readwrite';

    return (
      <Table definition>
        <Table.Body>
          {this.renderUsersRow('Admin', adminUsers)}
          {showReadonly && !myStudies && this.renderUsersRow('Read Only', readonlyUsers)}
          {showReadwrite && !myStudies && this.renderUsersRow('Read & Write', readwriteUsers)}
        </Table.Body>
      </Table>
    );
  }

  renderUsersRow(title, userIds = []) {
    const userIdentifiers = _.map(userIds, uid => ({ uid }));
    const users = this.usersStore.asUserObjects(userIdentifiers);

    return (
      <Table.Row>
        <Table.Cell width={2} className="nowrap">
          {title}
        </Table.Cell>
        <Table.Cell width={14} className="breakout">
          {!_.isEmpty(userIds) && <UserLabels users={users} />}
          {_.isEmpty(userIds) && <span>None</span>}
        </Table.Cell>
      </Table.Row>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(DataSourceStudyRow, {
  accountsStore: computed,
  study: computed,
  studyStore: computed,
  usersStore: computed,
  handleExpandClick: action,
  handleCheckConnection: action,
  handleDismissPanel: action,
  expanded: observable,
  connectionPanel: observable,
});

export default inject('dataSourceAccountsStore', 'usersStore')(withRouter(observer(DataSourceStudyRow)));
