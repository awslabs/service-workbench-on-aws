import _ from 'lodash';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { Button, Card, Divider, Header, Icon, Label, Modal } from 'semantic-ui-react';
import { action, computed, decorate, observable, runInAction } from 'mobx';
import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { gotoFn } from '@aws-ee/base-ui/dist/helpers/routing';

import * as EnvTypeStatusEnum from '../../models/environment-types/EnvTypeStatusEnum';

class EnvTypeCard extends Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.processing = false;
      this.shouldShowDeleteDialog = false;
    });
  }

  render() {
    const envType = this.props.envType;
    const isApproved = EnvTypeStatusEnum.isApproved(envType.status);
    return (
      <Card key={`et-${envType.id}`} raised className="mb3">
        <Card.Content>
          <Header as="h4">{envType.name}</Header>
          <Card.Meta className="flex">
            <span className="flex-auto">{_.get(envType, 'provisioningArtifact.name')}</span>
            <Label className="ml1" size="mini" color={isApproved ? 'green' : 'red'}>
              {isApproved ? 'Approved' : 'Not Approved'}
            </Label>
          </Card.Meta>
          <Divider />
          <Card.Description>
            <div className="mb3 pr1 pl1 pb1">
              {/* Yes, we are doing dangerouslySetInnerHTML, the content was already sanitized by showdownjs */}
              {/* eslint-disable-next-line react/no-danger */}
              <div dangerouslySetInnerHTML={{ __html: envType.descHtml }} />
            </div>
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <Button
            basic
            color="blue"
            onClick={() => this.handleEditClick(envType.id)}
            floated="right"
            size="mini"
            disabled={this.processing}
          >
            Edit
          </Button>
          <Button
            basic
            color="red"
            onClick={() => this.showDeleteDialog()}
            floated="right"
            size="mini"
            disabled={this.processing}
          >
            Delete
          </Button>
          {this.renderDeleteConfirmation(envType)}
          <Button
            basic
            color={isApproved ? 'red' : 'blue'}
            onClick={() => this.handleApproveRevokeClick(envType.id, isApproved)}
            floated="right"
            size="mini"
            disabled={this.processing}
          >
            {isApproved ? 'Revoke' : 'Approve'}
          </Button>
        </Card.Content>
      </Card>
    );
  }

  renderDeleteConfirmation(envType) {
    const shouldShowDeleteDialog = this.shouldShowDeleteDialog;
    const processing = this.processing;
    return (
      <Modal open={shouldShowDeleteDialog} onClose={this.hideDeleteDialog} closeOnDimmerClick={!processing}>
        <Modal.Header>Delete {envType.name}</Modal.Header>
        <Modal.Content>
          <p>Are you sure you want to delete {envType.name}?</p>
          <p>
            Once you delete environment type, users will not be able launch them. You will need to re-import it from the
            AWS Service Catalog Product.
          </p>
          <p>Is it okay to delete?</p>
        </Modal.Content>
        <Modal.Actions>
          <Button
            basic
            icon
            color="grey"
            labelPosition="right"
            size="mini"
            disabled={this.processing}
            onClick={this.hideDeleteDialog}
          >
            <Icon name="close" />
            Cancel
          </Button>
          <Button
            basic
            icon
            color="red"
            labelPosition="right"
            size="mini"
            disabled={this.processing}
            onClick={() => this.handleDeleteClick(envType.id)}
          >
            <Icon name="trash" /> Delete
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }

  showDeleteDialog = () => {
    this.shouldShowDeleteDialog = true;
    this.processing = false;
  };

  hideDeleteDialog = () => {
    if (this.processing) return;
    this.shouldShowDeleteDialog = false;
  };

  handleApproveRevokeClick = async (id, revoking = false) => {
    this.processing = true;
    const store = this.envTypesStore;
    try {
      if (revoking) {
        await store.revokeEnvType(id);
      } else {
        await store.approveEnvType(id);
      }
    } catch (error) {
      displayError(error);
    }
    runInAction(() => {
      this.processing = false;
    });
  };

  handleDeleteClick = async id => {
    this.processing = true;
    const store = this.envTypesStore;
    try {
      await store.deleteEnvType(id);
    } catch (error) {
      displayError(error);
    }
    runInAction(() => {
      this.processing = false;
      this.hideDeleteDialog();
    });
  };

  handleEditClick = async id => {
    const goto = gotoFn(this);
    goto(`/workspace-types-management/edit/${encodeURIComponent(id)}`);
  };

  get envTypesStore() {
    return this.props.envTypesStore;
  }
}

decorate(EnvTypeCard, {
  processing: observable,
  envTypesStore: computed,
  shouldShowDeleteDialog: observable,

  handleEditClick: action,
  handleDeleteClick: action,
  handleApproveRevokeClick: action,
  showDeleteDialog: action,
  hideDeleteDialog: action,
});
export default withRouter(observer(EnvTypeCard));
