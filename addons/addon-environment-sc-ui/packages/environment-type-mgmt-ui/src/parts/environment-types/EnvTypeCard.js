/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import _ from 'lodash';
import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
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

    const pluginRegistry = this.props.pluginRegistry;
    const defaultMetaActions = [];
    const metaActions = pluginRegistry.visitPlugins(
      'env-type-management',
      'getEnvTypeCardMetaActions',
      {
        payload: defaultMetaActions,
      },
      envType,
    );

    const defaultMgmtActions = [
      <Button
        data-testid={`editbutton-${envType.name}`}
        key="env-type-mgmt-action-edit"
        basic
        color="blue"
        onClick={() => this.handleEditClick(envType.id)}
        floated="right"
        size="mini"
        disabled={this.processing}
      >
        Edit
      </Button>,
      <Button
        key="env-type-mgmt-action-delete"
        basic
        color="red"
        onClick={() => this.showDeleteDialog()}
        floated="right"
        size="mini"
        disabled={this.processing}
      >
        Delete
      </Button>,
      this.renderDeleteConfirmation(envType),
      <Button
        key="env-type-mgmt-action-revoke-or-approve"
        basic
        color={isApproved ? 'red' : 'blue'}
        onClick={() => this.handleApproveRevokeClick(envType.id, isApproved)}
        floated="right"
        size="mini"
        disabled={this.processing}
      >
        {isApproved ? 'Revoke' : 'Approve'}
      </Button>,
    ];
    const mgmtActions = pluginRegistry.visitPlugins(
      'env-type-management',
      'getEnvTypeCardMgmtActions',
      {
        payload: defaultMgmtActions,
      },
      envType,
    );

    return (
      <Card data-testid="env-type-card" key={`et-${envType.id}`} raised className="mb3">
        <Card.Content>
          <Header as="h4">{envType.name}</Header>
          <Card.Meta className="flex">
            <span className="fs-8 color-grey mr2">{envType.id}</span>
            <Label className="ml1" size="mini" color={isApproved ? 'green' : 'red'}>
              {isApproved ? 'Approved' : 'Not Approved'}
            </Label>
          </Card.Meta>
          {_.map(metaActions, c => c)}
          <Divider />
          <Card.Description>
            <div className="mb3 pr1 pl1 pb1">
              {/* Yes, we are doing dangerouslySetInnerHTML, the content was already sanitized by showdownjs */}
              {/* eslint-disable-next-line react/no-danger */}
              <div dangerouslySetInnerHTML={{ __html: envType.descHtml }} />
            </div>
          </Card.Description>
        </Card.Content>
        <Card.Content extra>{_.map(mgmtActions, c => c)}</Card.Content>
      </Card>
    );
  }

  renderDeleteConfirmation(envType) {
    const shouldShowDeleteDialog = this.shouldShowDeleteDialog;
    const processing = this.processing;
    return (
      <Modal
        key="env-type-mgmt-action-delete-confirmation"
        open={shouldShowDeleteDialog}
        onClose={this.hideDeleteDialog}
        closeOnDimmerClick={!processing}
      >
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
export default inject('pluginRegistry')(withRouter(observer(EnvTypeCard)));
