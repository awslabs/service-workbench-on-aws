import React from 'react';
import _ from 'lodash';
import { decorate, computed, action } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Segment, Header, Icon, Button, Label } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import {
  isStoreReady,
  isStoreLoading,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
  stopHeartbeat,
} from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';

import DataSourceAccountCard from './DataSourceAccountCard';

// expected props
// - dataSourceAccountsStore (via injection)
class DataSourceAccountsList extends React.Component {
  componentDidMount() {
    window.scrollTo(0, 0);
    const store = this.accountsStore;
    if (!isStoreReady(store)) {
      swallowError(store.load());
    }
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.envsStore;
    stopHeartbeat(store);
  }

  get accountsStore() {
    return this.props.dataSourceAccountsStore;
  }

  handleRegisterStudies = event => {
    event.preventDefault();
    event.stopPropagation();

    const goto = gotoFn(this);
    goto(`/data-sources/register`);
  };

  render() {
    const store = this.accountsStore;
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={2} />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3 animated fadeIn">
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderMain() {
    const store = this.accountsStore;
    const list = store.list;

    return (
      <>
        {_.map(list, item => (
          <Segment className="pr3 pl3 pb3 pt1 mb3" clearing key={item.id}>
            <DataSourceAccountCard account={item} />
          </Segment>
        ))}
      </>
    );
  }

  renderEmpty() {
    return (
      <Segment data-testid="data-sources-accounts" placeholder>
        <Header icon className="color-grey">
          <Icon name="database" />
          No data sources
          <Header.Subheader>To create a data source, click Register Studies.</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="database" className="align-top" />
          <Header.Content className="left-align">Data Sources {this.renderTotal()}</Header.Content>
        </Header>
        <div>
          <Button data-testid="register-data-studies" color="blue" size="medium" onClick={this.handleRegisterStudies}>
            Register Studies
          </Button>
        </div>
      </div>
    );
  }

  renderTotal() {
    const store = this.accountsStore;
    if (isStoreError(store) || isStoreLoading(store)) return null;

    return <Label circular>{store.total}</Label>;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(DataSourceAccountsList, {
  accountsStore: computed,
  handleRegisterStudies: action,
});

export default inject('dataSourceAccountsStore')(withRouter(observer(DataSourceAccountsList)));
