import React from 'react';
import { inject, observer } from 'mobx-react';
import { withRouter } from 'react-router-dom';
import { decorate, observable, action, runInAction } from 'mobx';
import { Button, Dimmer, Header, List, Loader, Dropdown, Segment } from 'semantic-ui-react';
import _ from 'lodash';

import { displayError } from '@aws-ee/base-ui/dist/helpers/notification';
import { createLink } from '@aws-ee/base-ui/dist/helpers/routing';
import validate from '@aws-ee/base-ui/dist/models/forms/Validate';

import { getAddProjectForm, getAddProjectFormFields } from '../../models/forms/AddProjectForm';

class AddProject extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // eslint-disable-next-line react/no-unused-state
      role: 'guest',
      // eslint-disable-next-line react/no-unused-state
      status: 'active',
      indexId: '',
    };

    runInAction(() => {
      this.formProcessing = false;
      this.validationErrors = new Map();
      this.project = {};
    });
    this.form = getAddProjectForm();
    this.addProjectFormFields = getAddProjectFormFields();
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  render() {
    return (
      <div className="mt2 animated fadeIn">
        <Header as="h2" icon textAlign="center" className="mt3" color="grey">
          Add Project
        </Header>
        <div className="mt3 ml3 mr3 animated fadeIn">{this.renderAddProjectForm()}</div>
      </div>
    );
  }

  // eslint-disable-next-line react/no-unused-state
  handleRoleChange = (e, { value }) => this.setState({ role: value });

  // eslint-disable-next-line react/no-unused-state
  handleStatusChange = (e, { value }) => this.setState({ status: value });

  renderAddProjectForm() {
    const processing = this.formProcessing;
    const fields = this.addProjectFormFields;
    const toEditableInput = (attributeName, type = 'text') => {
      const handleChange = action(event => {
        event.preventDefault();
        this.project[attributeName] = event.target.value;
      });
      return (
        <div className="ui focus input">
          <input
            type={type}
            defaultValue={this.project[attributeName]}
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
        <div className="mb4" />
        {this.renderField('indexId')}
        {this.renderIndexSelection()}
        <div className="mb4" />
        {this.renderField('description', toEditableInput('description', 'description'))}
        {this.renderButtons()}
      </Segment>
    );
  }

  renderButtons() {
    const processing = this.formProcessing;
    return (
      <div className="mt3">
        <Button floated="right" color="blue" icon disabled={processing} className="ml2" onClick={this.handleSubmit}>
          Add Project
        </Button>
        <Button floated="right" disabled={processing} onClick={this.handleCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  renderIndexSelection() {
    const indexIdOption = this.props.indexesStore.dropdownOptions;
    return (
      <Dropdown
        options={indexIdOption}
        placeholder="Please assign indexes to this project"
        fluid
        selection
        onChange={this.handleIndexSelection}
      />
    );
  }

  handleIndexSelection = (e, { value }) => this.setState({ indexId: value });

  renderField(name, component) {
    const fields = this.addProjectFormFields;
    const explain = fields[name].explain;
    const label = fields[name].label;
    const hasExplain = !_.isEmpty(explain);
    const fieldErrors = this.validationErrors.get(name);
    const hasError = !_.isEmpty(fieldErrors);

    return (
      <div>
        <Header className="mr3 mt0" as="h2" color="grey">
          {label}
        </Header>
        {hasExplain && <div className="mb2">{explain}</div>}
        <div className={`ui big field input block m0 ${hasError ? 'error' : ''}`}>{component}</div>
        {hasError && (
          <div className="ui pointing red basic label">
            <List>
              {_.map(fieldErrors, fieldError => (
                <List.Item key={name}>
                  <List.Content>{fieldError}</List.Content>
                </List.Item>
              ))}
            </List>
          </div>
        )}
      </div>
    );
  }

  handleCancel = action(event => {
    event.preventDefault();
    event.stopPropagation();
    this.formProcessing = false;
    this.goto('/accounts');
  });

  handleSubmit = action(async () => {
    this.formProcessing = true;
    try {
      // Perform client side validations first
      const validationResult = await validate(this.project, this.addProjectFormFields);
      // if there are any client side validation errors then do not attempt to make API call
      if (validationResult.fails()) {
        runInAction(() => {
          this.validationErrors = validationResult.errors;
          this.formProcessing = false;
        });
      } else {
        // There are no client side validation errors so ask the store to add user (which will make API call to server to add the user)
        this.project.indexId = this.state.indexId;
        await this.props.projectsStore.addProject(this.project);
        runInAction(() => {
          this.formProcessing = false;
        });
        this.goto('/accounts');
      }
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(error);
    }
  });

  getStore() {
    return this.props.usersStore;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(AddProject, {
  formProcessing: observable,
  user: observable,
  validationErrors: observable,
});
export default inject('usersStore', 'indexesStore', 'projectsStore')(withRouter(observer(AddProject)));
