import _ from 'lodash';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate, action, runInAction, observable } from 'mobx';
import { withRouter } from 'react-router-dom';
import { Header, Icon, Segment, Button } from 'semantic-ui-react';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import { isStoreEmpty, isStoreNotEmpty } from '@aws-ee/base-ui/dist/models/BaseStore';
import Stores from '@aws-ee/base-ui/dist/models/Stores';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';

import WorkflowCommonDraftCard from '../../workflow-common/drafts/WorkflowCommonDraftCard';
import ProgressPlaceHolder from '../../workflow-common/ProgressPlaceholder';
import CreateDraftWizard from './CreateWorkflowDraft';
import WorkflowTemplateCardTabs from '../../workflow-templates/WorkflowTemplateCardTabs';

// expected props
// - workflowDraftsStore (via injection)
// - stepTemplatesStore (via injection)
// - location (from react router)
class WorkflowDraftsList extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.showCreateDraftWizard = false;
      this.stores = new Stores([this.getStore(), this.props.stepTemplatesStore]);
    });
  }

  componentDidMount() {
    this.getStores().load();
    const store = this.getStore();
    swallowError(store.load());
    store.startHeartbeat();
  }

  componentWillUnmount() {
    const store = this.getStore();
    store.stopHeartbeat();
  }

  getStores() {
    return this.stores;
  }

  getStore() {
    return this.props.workflowDraftsStore;
  }

  handleCreateDraftClick() {
    this.showCreateDraftWizard = true;
  }

  handleCreateDraftCancel() {
    this.showCreateDraftWizard = false;
  }

  handleEditDraft = async draft => {
    const goto = gotoFn(this);
    goto(`/workflows/drafts/edit/${encodeURIComponent(draft.id)}`);
  };

  render() {
    const stores = this.getStores();
    const store = this.getStore();
    let content = null;

    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0" />;
    } else if (stores.loading) {
      content = <ProgressPlaceHolder />;
    } else if (stores.ready && isStoreEmpty(store)) {
      content = this.renderEmpty();
    } else if (stores.ready && isStoreNotEmpty(store)) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <div className="mb4">
        {this.renderTitle()}
        {this.renderWizard()}
        {content}
      </div>
    );
  }

  renderEmpty() {
    const show = this.showCreateDraftWizard;
    if (show) return null;
    return (
      <Segment placeholder>
        <Header icon className="color-grey">
          <Icon name="edit outline" />
          No workflow drafts
        </Header>
      </Segment>
    );
  }

  renderTitle() {
    const disabled = this.showCreateDraftWizard;
    return (
      <div className="mb3 flex">
        <Header as="h3" className="color-grey mt1 mb0 flex-auto">
          <Icon name="edit outline" className="align-top" />
          <Header.Content className="left-align">Workflow Drafts</Header.Content>
        </Header>
        <div>
          <Button basic color="blue" disabled={disabled} onClick={() => this.handleCreateDraftClick()}>
            Create Draft
          </Button>
        </div>
      </div>
    );
  }

  renderWizard() {
    const show = this.showCreateDraftWizard;
    if (!show) return null;
    return <CreateDraftWizard onCancel={() => this.handleCreateDraftCancel()} />;
  }

  renderMain() {
    const store = this.getStore();
    const list = store.list;

    return (
      <div>
        {_.map(list, draft => (
          <Segment className="mb2" clearing key={draft.id}>
            <WorkflowCommonDraftCard
              draft={draft}
              draftsStore={store}
              onEdit={this.handleEditDraft}
              className="pt0 pl2 pr2 pb2"
            >
              {({ uiState, version }) => <WorkflowTemplateCardTabs template={version} uiState={uiState} />}
            </WorkflowCommonDraftCard>
          </Segment>
        ))}
      </div>
    );
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowDraftsList, {
  handleCreateDraftClick: action,
  handleCreateDraftCancel: action,
  handleEditDraft: action,
  showCreateDraftWizard: observable,
});

export default inject('workflowDraftsStore', 'stepTemplatesStore')(withRouter(observer(WorkflowDraftsList)));
