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

import React from 'react';
import { observer } from 'mobx-react';
import { decorate, observable, action, runInAction, computed } from 'mobx';
import { Button, Dimmer, Header, Loader, Table, Label, Dropdown, Segment, Modal } from 'semantic-ui-react';
import _ from 'lodash';
import { displayError, displaySuccess } from '@aws-ee/base-ui/dist/helpers/notification';
import Stores from '@aws-ee/base-ui/dist/models/Stores';
import { swallowError } from '@aws-ee/base-ui/dist/helpers/utils';
import ErrorBox from '@aws-ee/base-ui/dist/parts/helpers/ErrorBox';
import BasicProgressPlaceholder from '@aws-ee/base-ui/dist/parts/helpers/BasicProgressPlaceholder';
import { getAddProjectFormFields, getAddProjectForm } from '../../models/forms/AddProjectForm';

class ProjectConfigure extends React.Component {
  constructor(props) {
    super(props);
    runInAction(() => {
      this.stores = new Stores([this.usersStore, this.awsAccountsStore, this.projectsStore, this.userStore]);
      const { rev, id, description, indexId, projectAdmins } = this.props.project;
      this.updateProject = {
        rev,
        id,
        description,
        indexId,
        projectAdmins,
      };
      this.formProcessing = false;
      this.modalOpen = false;
      this.view = 'detail';
    });
    this.form = getAddProjectForm();
    this.addProjectFormFields = getAddProjectFormFields();
    this.currentProject = this.props.project;
  }

  componentWillUnmount() {
    this.cleanUp();
  }

  getStores() {
    return this.stores;
  }

  componentDidMount() {
    swallowError(this.getStores().load());
  }

  cleanUp() {
    runInAction(() => {
      this.modalOpen = false;
    });
  }

  handleModalOpen = () => {
    runInAction(() => {
      const { rev, id, description, indexId, projectAdmins } = this.props.project;
      this.updateProject = {
        rev,
        id,
        description,
        indexId,
        projectAdmins,
      };
      this.formProcessing = false;
      this.modalOpen = false;
      this.view = 'detail';
      this.modalOpen = true;
    });
  };

  handleModalClose = () => {
    this.cleanUp();
  };

  renderDetailView() {
    const getFieldLabel = fieldName => this.form.$(fieldName).label;
    const toRow = fieldName => {
      const value = _.get(this.currentProject, fieldName);
      const displayValue = _.isArray(value)
        ? _.map(value, (v, k) => {
            const user = this.usersStore.asUserObject({ uid: v });
            return <Label key={k} content={user.username} />;
          })
        : value;
      return (
        <>
          <Table.Cell collapsing active>
            {getFieldLabel(fieldName)}
          </Table.Cell>
          <Table.Cell>{displayValue}</Table.Cell>
        </>
      );
    };

    return (
      <Segment basic className="ui fluid form mb4">
        <Table celled>
          <Table.Body>
            <Table.Row>{toRow('id')}</Table.Row>
            <Table.Row>{toRow('description')}</Table.Row>
            <Table.Row>{toRow('projectAdmins')}</Table.Row>
          </Table.Body>
        </Table>
        {this.renderButtons()}
      </Segment>
    );
  }

  renderTrigger() {
    return (
      <Button size="mini" compact color="blue" onClick={this.handleModalOpen}>
        Detail
      </Button>
    );
  }

  renderMain() {
    let content = null;
    if (this.view === 'detail') {
      content = this.renderDetailView();
    } else if (this.view === 'edit') {
      content = this.renderEditView();
    }
    return content;
  }

  render() {
    const stores = this.getStores();
    let content = null;
    if (stores.hasError) {
      content = <ErrorBox error={stores.error} className="p0 mb3" />;
    } else if (stores.loading) {
      content = <BasicProgressPlaceholder />;
    } else if (stores.ready) {
      content = this.renderMain();
    } else {
      content = null;
    }

    return (
      <Modal closeIcon trigger={this.renderTrigger()} open={this.modalOpen} onClose={this.handleModalClose}>
        <div className="mt2 animated fadeIn">
          <Header as="h3" icon textAlign="center" className="mt3" color="grey">
            Project Detail
          </Header>
          <div className="mt3 ml3 mr3 animated fadeIn">{content}</div>
        </div>
      </Modal>
    );
  }

  renderEditView() {
    const processing = this.formProcessing;
    const fields = this.addProjectFormFields;
    const toEditableInput = (attributeName, type = 'text') => {
      const handleChange = action(event => {
        event.preventDefault();
        this.updateProject[attributeName] = event.target.value;
      });
      return (
        <div className="ui focus input">
          <input
            type={type}
            defaultValue={this.currentProject[attributeName]}
            placeholder={fields[attributeName].placeholder || ''}
            onChange={handleChange}
          />
        </div>
      );
    };

    return (
      <Segment basic className="ui fluid form">
        <Dimmer active={processing} inverted>
          <Loader inverted>Checking</Loader>
        </Dimmer>
        {this.renderField('id', toEditableInput('id', 'id'))}
        <div className="mb2" />
        {this.renderField('description', toEditableInput('description', 'description'))}
        <div className="mb2" />
        {this.renderField('projectAdmins')}
        {this.renderProjectAdminsSelection()}
        <div className="mb2" />
        {this.renderButtons()}
        <div className="mb4" />
      </Segment>
    );
  }

  handleClickEditButton = () => {
    runInAction(() => {
      this.view = 'edit';
    });
  };

  handleClickCancelButton = () => {
    if (this.view === 'edit') {
      runInAction(() => {
        this.view = 'detail';
      });
    } else {
      this.handleModalClose();
    }
  };

  handleClickSubmitButton = action(async () => {
    if (!this.updateProject.id) {
      this.updateProject.id = this.currentProject.id;
    }
    runInAction(() => {
      this.formProcessing = true;
    });
    try {
      const store = this.getStore();
      await store.updateProject(this.updateProject);

      runInAction(() => {
        this.formProcessing = false;
      });

      this.cleanUp();

      displaySuccess('Updated project successfully');
    } catch (err) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(err);
    }
  });

  renderButtons() {
    const processing = this.formProcessing;

    const makeButton = ({ label = '', color = 'blue', floated = 'left', ...props }) => {
      return (
        <Button color={color} floated={floated} disabled={processing} className="ml2" {...props}>
          {label}
        </Button>
      );
    };

    const editButton = this.view === 'detail' ? makeButton({ label: 'Edit', onClick: this.handleClickEditButton }) : '';

    const saveButton = this.view === 'edit' ? makeButton({ label: 'Save', onClick: this.handleClickSubmitButton }) : '';

    const cancelButton = makeButton({
      label: 'Cancel',
      floated: 'right',
      color: 'grey',
      onClick: this.handleClickCancelButton,
    });

    return (
      <div className="mt3 mb3">
        <Modal.Actions>
          {cancelButton}
          {saveButton}
          {editButton}
        </Modal.Actions>
      </div>
    );
  }

  renderProjectAdminsSelection() {
    const usersStore = this.props.usersStore;
    const projectAdminsOption = usersStore.asDropDownOptions();
    const currentProjectAdminUsers = _.map(this.currentProject.projectAdmins, uid => usersStore.asUserObject({ uid }));
    return (
      <Dropdown
        options={projectAdminsOption}
        defaultValue={_.map(currentProjectAdminUsers, x => x.uid)}
        fluid
        multiple
        selection
        onChange={this.handleProjectAdminsSelection}
      />
    );
  }

  handleProjectAdminsSelection = (e, { value }) => {
    runInAction(() => {
      this.updateProject.projectAdmins = value;
    });
  };

  renderField(name, component, contentRenderer) {
    const fields = this.addProjectFormFields;
    const explain = fields[name].explain;
    const label = fields[name].label;
    const hasExplain = !_.isEmpty(explain);
    let content = this.currentProject[name];
    if (contentRenderer && typeof contentRenderer === 'function') {
      content = contentRenderer(content);
    }
    content = _.isEmpty(content) ? 'N/A' : content;

    return (
      <div>
        <Header className="mr3 mt0" as="h4" color="grey">
          {label}
        </Header>
        {hasExplain && (
          <div className="mb2">
            {explain} <span>{this.view === 'detail' ? content : ''}</span>
          </div>
        )}
        <div className="ui field input block m0">{component}</div>
      </div>
    );
  }

  getStore() {
    return this.props.projectsStore;
  }

  get userStore() {
    return this.props.userStore;
  }

  get usersStore() {
    return this.props.usersStore;
  }

  get awsAccountsStore() {
    return this.props.awsAccountsStore;
  }

  get projectStore() {
    return this.props.projectsStore.getProjectStore();
  }

  get projectsStore() {
    return this.props.projectsStore;
  }
}

// Using the MobX 4 way to use decorators without decorator syntax
decorate(ProjectConfigure, {
  formProcessing: observable,
  modalOpen: observable,
  view: observable,
  updateProject: observable,

  projectsStore: computed,
  awsAccountsStore: computed,
  usersStore: computed,
  userStore: computed,

  handleClickSubmitButton: action,
});
export default observer(ProjectConfigure);
