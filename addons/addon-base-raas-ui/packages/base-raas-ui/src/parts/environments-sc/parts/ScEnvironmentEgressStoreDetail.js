import React from 'react';
import ReactTable from 'react-table';
import { decorate, action, observable, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Segment, Icon, Header, Button } from 'semantic-ui-react';

import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import {
  isStoreLoading,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
  isStoreReady,
} from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

// TODO: remove tempData
const tempData = [];
class ScEnvironmentEgressStoreDetail extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      // A flag to indicate if egress request for this egress store is already submitted
      this.egressStoreRequestSubmitted = this.getEgressStoreDetailStore().egressStoreStatus === 'submitted';
    });
  }

  componentDidMount() {
    const store = this.getEgressStoreDetailStore();
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
  }

  getEgressStoreDetailStore() {
    return this.props.scEnvironmentEgressStoreDetailStore;
  }

  handleSubmitEgressRequest = () => {
    runInAction(() => {
      this.egressStoreRequestSubmitted = !this.egressStoreRequestSubmitted;
      console.log('egress request submitted');
    });
    // TODO: invoke store action to actually submit the request
  };

  render() {
    const store = this.getEgressStoreDetailStore();
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
    const showPagination = tempData.length > pageSize;
    const egressStoreRequestSubmitted = this.egressStoreRequestSubmitted;
    return (
      <Segment placeholder className="mt2 mb2">
        <ReactTable
          data={tempData}
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
              accessor: 'objectName',
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
              Header: 'Workspace Owner',
              width: 150,
              style: { whiteSpace: 'unset' },
              Cell: row => {
                const object = row.original;
                return object.workspaceOwner.join(', ') || '<<none>>';
              },
            },
            {
              Header: 'Studies',
              width: 150,
              style: { whiteSpace: 'unset' },
              Cell: row => {
                const object = row.original;
                return object.study.join(', ') || '<<none>>';
              },
            },
            {
              Header: 'Egress Status',
              accessor: 'egressStatus',
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
            disabled={egressStoreRequestSubmitted}
          >
            {!egressStoreRequestSubmitted ? 'Submit Egress Request' : 'Egress Request submitted'}
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
});

export default inject('scEnvironmentEgressStoreDetailStore')(withRouter(observer(ScEnvironmentEgressStoreDetail)));
