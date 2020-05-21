import _ from 'lodash';
import React from 'react';
import { observer, inject } from 'mobx-react';
import { decorate, action, observable, runInAction } from 'mobx';
import TimeAgo from 'react-timeago';
import { Header, Label, Button, Icon, Modal } from 'semantic-ui-react';
import c from 'classnames';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';

import getUIState from '../component-states/WorkflowCommonCardState';

// expected props
// - draft - a WorkflowTemplateDraft or WorkflowDraft model instance (via props)
// - draftsStore (via props) (either workflowTemplateDraftsStore or workflowDraftsStore)
// - onEdit (via props) called with (draft)
// - userDisplayName (via injection)
// - className (via props)
class WorkflowCommonDraftCard extends React.Component {
  constructor(props) {
    super(props);

    runInAction(() => {
      this.shouldShowDeleteDialog = false;
      this.deletingInProgress = false;
    });
  }

  getDraftsStore() {
    return this.props.draftsStore;
  }

  getState() {
    return getUIState(this.getDraft().id);
  }

  selectedMainTabIndex() {
    return this.getState().mainTabIndex;
  }

  getDraft() {
    return this.props.draft;
  }

  getVersion() {
    const draft = this.getDraft();
    return draft.template || draft.workflow;
  }

  getUserDisplayNameService() {
    return this.props.userDisplayName;
  }

  handleOnTabChange = (_event, data) => {
    this.getState().setMainTabIndex(data.activeIndex);
  };

  handleEditDraft = async event => {
    event.preventDefault();
    event.stopPropagation();
    const draft = this.getDraft();
    if (this.props.onEdit) return this.props.onEdit(draft);
    return undefined;
  };

  showDeleteDialog = () => {
    this.shouldShowDeleteDialog = true;
    this.deletingInProgress = false;
  };

  hideDeleteDialog = () => {
    if (this.deletingInProgress) return;
    this.shouldShowDeleteDialog = false;
  };

  handleDeleteDraft = async () => {
    const clean = () => {
      runInAction(() => {
        this.shouldShowDeleteDialog = false;
        this.deletingInProgress = false;
      });
    };

    const draft = this.getDraft();
    const draftsStore = this.getDraftsStore();

    try {
      this.deletingInProgress = true;
      await draftsStore.deleteDraft(draft);
      clean();
      displaySuccess('Draft deleted successfully');
    } catch (error) {
      clean();
      displayError(error);
    }
  };

  render() {
    const className = this.props.className;
    const draft = this.getDraft();
    const version = this.getVersion();
    const isTemplate = draft.template !== undefined;
    const { id, title } = version;
    const { createdAt, createdBy } = draft;
    const displayNameService = this.getUserDisplayNameService();
    const by = () => <span className="ml1">by {displayNameService.getDisplayName(createdBy)}</span>;

    return (
      <>
        <Label attached="top left">{isTemplate && 'Template '} Draft</Label>
        <div className={c(className)}>
          <div className="flex">
            <Header as="h3" color="grey" className="mt0 flex-auto ellipsis">
              {title}
              <Header.Subheader className="fs-9 color-grey">
                <div>
                  <span className="ellipsis breakout">{id}</span>
                </div>
                <div>
                  created <TimeAgo date={createdAt} /> {by()}
                </div>
              </Header.Subheader>
            </Header>
            <div>{this.renderActionButtons()}</div>
          </div>
          {this.renderMainTabs(version)}
        </div>
        {this.renderDeleteDialog(version)}
      </>
    );
  }

  renderDeleteDialog(version) {
    const shouldShowDeleteDialog = this.shouldShowDeleteDialog;
    const { id } = version;
    const progress = this.deletingInProgress;

    return (
      <Modal open={shouldShowDeleteDialog} size="tiny" onClose={this.hideDeleteDialog} closeOnDimmerClick={!progress}>
        <Header content="Delete Draft" />
        <Modal.Content>
          <p>Are you sure you want to delete draft &quot;{id}&quot; ?</p>
        </Modal.Content>
        <Modal.Actions>
          <Button disabled={progress} onClick={this.hideDeleteDialog}>
            Cancel
          </Button>
          <Button loading={progress} disabled={progress} color="red" onClick={this.handleDeleteDraft}>
            <Icon name="remove" /> Delete
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  renderActionButtons() {
    return (
      <Button.Group basic size="mini">
        <Button icon="edit" onClick={this.handleEditDraft} />
        <Button icon="trash" onClick={this.showDeleteDialog} />
      </Button.Group>
    );
  }

  renderMainTabs(version) {
    const renderer = _.isFunction(this.props.children) ? this.props.children : _.noop;
    const uiState = this.getState();
    return renderer({
      uiState,
      version,
    });
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(WorkflowCommonDraftCard, {
  showDeleteDialog: action,
  hideDeleteDialog: action,
  handleDeleteDraft: action,
  handleEditDraft: action,
  shouldShowDeleteDialog: observable,
  deletingInProgress: observable,
});

export default inject('userDisplayName')(observer(WorkflowCommonDraftCard));
