import React from 'react';
import _ from 'lodash';
import { decorate, computed, action, observable, runInAction } from 'mobx';
import { observer, inject } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Container, Segment, Header, Icon, Button, Label } from 'semantic-ui-react';

import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError, storage } from '@aws-ee/base-ui/dist/helpers/utils';
import storageKeys from '@aws-ee/base-ui/dist/models/constants/local-storage-keys';
import {
  isStoreLoading,
  isStoreEmpty,
  isStoreNotEmpty,
  isStoreError,
  isStoreReady,
} from '@aws-ee/base-ui/dist/models/BaseStore';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import ProgressPlaceHolder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import DocumentationClient from '@aws-ee/base-ui/dist/parts/documentation-client/DocumentationClient';

import { filterNames } from '../../models/environments-sc/ScEnvironmentsStore';
import ScEnvironmentCard from './ScEnvironmentCard';
import ScEnvironmentsFilterButtons from './parts/ScEnvironmentsFilterButtons';

// expected props
// - scEnvironmentsStore (via injection)
// - envTypesStore (via injection)
class ScEnvironmentsList extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      const key = storageKeys.workspacesFilterName;
      const name = storage.getItem(key) || filterNames.ALL;
      storage.setItem(key, name);
      this.selectedFilter = name;
    });
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    const store = this.envsStore;
    swallowError(store.load());
    store.startHeartbeat();

    const typesStore = this.envTypesStore;
    if (!isStoreReady(typesStore)) {
      swallowError(typesStore.load());
    }
  }

  componentWillUnmount() {
    const store = this.envsStore;
    store.stopHeartbeat();
  }

  get envTypesStore() {
    return this.props.envTypesStore;
  }

  get envsStore() {
    return this.props.scEnvironmentsStore;
  }

  handleCreateEnvironment = event => {
    event.preventDefault();
    event.stopPropagation();

    const goto = gotoFn(this);
    goto(`/workspaces/create`);
  };

  handleSelectedFilter = name => {
    this.selectedFilter = name;
    const key = storageKeys.workspacesFilterName;
    storage.setItem(key, name);
  };

  render() {
    const store = this.envsStore;
    let content = null;

    if (isStoreError(store)) {
      content = <ErrorBox error={store.error} className="p0" />;
    } else if (isStoreLoading(store)) {
      content = <ProgressPlaceHolder segmentCount={3} />;
    } else if (isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Container className="mt3 animated fadeIn">
        <DocumentationClient urlSuffix="user_guide/sidebar/common/workspaces/introduction" />
        {this.renderTitle()}
        {content}
      </Container>
    );
  }

  renderMain() {
    const store = this.envsStore;
    const selectedFilter = this.selectedFilter;
    const list = store.filtered(selectedFilter);
    const isEmpty = _.isEmpty(list);

    return (
      <div data-testid="workspaces">
        <ScEnvironmentsFilterButtons
          selectedFilter={selectedFilter}
          onSelectedFilter={this.handleSelectedFilter}
          className="mb3"
        />
        {!isEmpty &&
          _.map(list, item => (
            <Segment className="p3 mb4" clearing key={item.id}>
              <ScEnvironmentCard scEnvironment={item} />
            </Segment>
          ))}
        {isEmpty && (
          <Segment placeholder>
            <Header icon className="color-grey">
              <Icon name="server" />
              No research workspaces matching the selected filter.
              <Header.Subheader>Select &apos;All&apos; to view all the workspaces</Header.Subheader>
            </Header>
          </Segment>
        )}
      </div>
    );
  }

  renderEmpty() {
    return (
      <Segment data-testid="workspaces" placeholder>
        <Header icon className="color-grey">
          <Icon name="server" />
          No research workspaces
          <Header.Subheader>To create a research workspace, click Create Research Workspace.</Header.Subheader>
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="server" className="align-top" />
          <Header.Content className="left-align">Research Workspaces {this.renderTotal()}</Header.Content>
        </Header>
        <div>
          <Button
            data-testid="create-workspace"
            color="blue"
            size="medium"
            basic
            onClick={this.handleCreateEnvironment}
          >
            Create Research Workspace
          </Button>
        </div>
      </div>
    );
  }

  renderTotal() {
    const store = this.envsStore;
    if (isStoreError(store) || isStoreLoading(store)) return null;

    return <Label circular>{store.total}</Label>;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(ScEnvironmentsList, {
  selectedFilter: observable,
  envsStore: computed,
  envTypesStore: computed,
  handleCreateEnvironment: action,
  handleSelectedFilter: action,
});

export default inject('scEnvironmentsStore', 'envTypesStore')(withRouter(observer(ScEnvironmentsList)));
