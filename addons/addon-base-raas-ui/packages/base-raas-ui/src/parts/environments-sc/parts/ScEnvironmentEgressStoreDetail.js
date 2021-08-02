import React from 'react';
import ReactTable from 'react-table';
import { decorate, action, observable, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Header, Button } from 'semantic-ui-react';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import {
  isStoreLoading,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
  isStoreReady,
} from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

class ScEnvironmentEgressStoreDetail extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // A flag to indicate if egress request for this egress store is already submitted
      this.isAbleToSubmitEgressRequest = true;
    });
  }

  componentDidMount() {
    const store = this.egressStoreDetailStore;
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
  }

  get environment() {
    return this.props.scEnvironment;
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  get egressStoreDetailStore() {
    return this.envsStore.getScEnvironmentEgressStoreDetailStore(this.environment.id);
  }

  handleSubmitEgressRequest = async () => {
    const egressStoreDetailStore = this.egressStoreDetailStore;
    try {
      runInAction(() => {
        this.isAbleToSubmitEgressRequest = false;
      });
      await egressStoreDetailStore.egressNotifySns(this.environment.id);
    } catch (error) {
      displayError(error);
      runInAction(() => {
        this.isAbleToSubmitEgressRequest = false;
      });
    }
  };

  render() {
    const store = this.egressStoreDetailStore;
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="pt2 mb2" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={1} className="mt2 mb2" />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreNotEmpty(store)) {
      content = this.renderEgressStoreTable();
    } else {
      content = null;
    }
    return <div className="fadeIn animated">{content}</div>;
  }

  renderConnections() {
    return (
      <Segment placeholder className="mt2 mb2">
        <Header icon className="color-grey">
          <Icon name="file outline" />
          Empty Egress Store
          <Header.Subheader>This workspace egress store is empty.</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderEmpty() {
    return (
      <Segment placeholder className="mt2 mb2">
        <Header icon className="color-grey">
          <Icon name="file outline" />
          Empty Egress Store
          <Header.Subheader>This workspace egress store is empty.</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderEgressStoreTable() {
    const pageSize = 5;
    const data = this.egressStoreDetailStore.list;
    const showPagination = data.length > pageSize;
    const isAbleToSubmitEgressRequest = this.isAbleToSubmitEgressRequest;
    return (
      <Segment placeholder className="mt2 mb2">
        <ReactTable
          data={data}
          defaultSorted={[{ id: 'objectName', desc: true }]}
          showPagination={showPagination}
          defaultPageSize={pageSize}
          className="-striped -highlight"
          filterable
          defaultFilterMethod={(filter, row) => {
            const columnValue = String(row[filter.id]).toLowerCase();
            const filterValue = filter.value.toLowerCase();
            return columnValue.indexOf(filterValue) >= 0;
          }}
          columns={[
            {
              Header: 'Name',
              accessor: 'Key',
              width: 100,
            },
            {
              Header: 'ETag',
              accessor: 'ETag',
              width: 100,
            },
            {
              Header: 'Project',
              accessor: 'projectId',
              width: 100,
            },
            {
              Header: 'Workspace Id',
              accessor: 'workspaceId',
              width: 100,
            },
            {
              Header: 'LastModified',
              accessor: 'LastModified',
              width: 100,
            },
            {
              Header: 'Size',
              accessor: 'Size',
              width: 100,
            },
            {
              Header: 'StorageClass',
              accessor: 'StorageClass',
              width: 100,
            },
          ]}
        />
        <div className="clearfix" style={{ minHeight: '42px' }}>
          <Button
            floated="right"
            basic
            size="mini"
            className="mt1 mb1 ml2"
            toggle
            active
            onClick={this.handleSubmitEgressRequest}
            disabled={!isAbleToSubmitEgressRequest}
          >
            {isAbleToSubmitEgressRequest ? 'Submit Egress Request' : 'Egress Request submitted'}
          </Button>
        </div>
      </Segment>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentEgressStoreDetail, {
  egressStoreRequestSubmitted: observable,
  handleSubmitEgressRequest: action,
  isAbleToSubmitEgressRequest: observable,
});

export default inject('scEnvironmentsStore')(withRouter(observer(ScEnvironmentEgressStoreDetail)));
