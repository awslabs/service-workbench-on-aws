
import React from 'react';
import { observer } from 'mobx-react';
import { decorate, observable, action, runInAction } from 'mobx';
import {
  Button,
  Dimmer,
  Header,
  List,
  Loader,
  Dropdown,
  Segment,
  Modal,
  Menu,
  Icon,
  Radio,
  Form,
} from 'semantic-ui-react';
import _ from 'lodash';

import { getUpdateUserConfigForm, getUpdateUserConfigFormFields } from '../../models/forms/UpdateUserConfig';
import { displayError } from '../../helpers/notification';
import { createLink } from '../../helpers/routing';
import validate from '../../models/forms/Validate';
import Stores from '../../../src/models/Stores';
import { swallowError } from '../../../src/helpers/utils';

class UserConfigure extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      view: 'detail',
      identityProviderName: 'auth0',
      status: 'active',
      raasProjectId: [],
      userRole: '',
      modalOpen: false,
    };
    runInAction(() => {
      this.formProcessing = false;
      this.validationErrors = new Map();
      this.updateUser = {};
      this.stores = new Stores([
        this.props.userStore,
        this.props.usersStore,
        this.props.userRolesStore,
        this.props.awsAccountsStore,
        this.props.raasProjectsStore,
      ]);
    });
    this.form = getUpdateUserConfigForm();
    this.getUpdateUserConfigFormFields = getUpdateUserConfigFormFields();
    this.currentUser = this.props.user;
    this.adminMode = this.props.adminMode;
  }

  goto(pathname) {
    const location = this.props.location;
    const link = createLink({ location, pathname });
    this.props.history.push(link);
  }

  componentWillUnmount() {
    this.cleanUp();
    this.setState({
      modalOpen: false,
      view: 'detail',
      identityProviderName: 'auth0',
      status: 'active',
      raasProjectId: [],
      userRole: '',
    });
    this.props.usersStore.startHeartbeat();
  }

  getStores() {
    return this.stores;
  }

  componentDidMount() {
    swallowError(this.getStores().load());
  }

  cleanUp() {
    this.setState({
      modalOpen: false,
    });
  }

  handleOpen = () => {
    this.props.usersStore.stopHeartbeat();
    this.setState({
      modalOpen: true,
      raasProjectId: this.props.user.raasProjectId,
      userRole: this.props.user.userRole,
    });
  };

  handleClose = () => {
    this.cleanUp();
  };

  renderDetailView() {
    return (
      <Segment basic className="ui fluid form">
        {this.renderField('username')}
        <div className="mb1" />
        {this.renderField('firstName')}
        <div className="mb1" />
        {this.renderField('lastName')}
        <div className="mb1" />
        {this.renderField('userRole')}
        <div className="mb1" />
        {this.renderField('isExternalUser', null, value => (value ? 'EXTERNAL' : 'INTERNAL BLAH'))}
        <div className="mb1" />
        {this.renderField('identityProviderName')}
        <div className="mb1" />
        {this.renderField('raasProjectId', null, (value = []) => value.join(', '))}
        <div className="mb1" />
        {this.currentUser.status === 'pending' && this.renderField('applyReason')}
        <div className="mb1" />
        {this.renderField('status')}
        {this.renderButtons()}
        <div className="mb4" />
      </Segment>
    );
  }

  renderTrigger() {
    let content = null;
    if (this.props.adminMode) {
      content = (
        <Button size="mini" compact color="blue" onClick={this.handleOpen}>
          Detail
        </Button>
      );
    } else {
      content = (
        <Menu.Item onClick={this.handleOpen}>
          <Icon name="user" /> {this.props.userStore.user.displayName}
        </Menu.Item>
      );
    }
    return content;
  }

  render() {
    let content = null;
    if (this.state.view === 'detail') {
      content = this.renderDetailView();
    } else if (this.state.view === 'edit') {
      content = this.renderUpdateUserConfigForm();
    }
    return (
      <Modal closeIcon trigger={this.renderTrigger()} open={this.state.modalOpen} onClose={this.handleClose}>
        <div className="mt2 animated fadeIn">
          <Header as="h3" icon textAlign="center" className="mt3" color="grey">
            User Detail
          </Header>
          <div className="mt3 ml3 mr3 animated fadeIn">{content}</div>
        </div>
      </Modal>
    );
  }

  renderUpdateUserConfigForm() {
    const processing = this.formProcessing;
    const fields = this.getUpdateUserConfigFormFields;
    const toEditableInput = (attributeName, type = 'text') => {
      const handleChange = action(event => {
        event.preventDefault();
        this.updateUser[attributeName] = event.target.value;
      });
      return (
        <div className="ui focus input">
          <input
            type={type}
            defaultValue={this.currentUser[attributeName]}
            placeholder={fields[attributeName].placeholder || ''}
            onChange={handleChange}
          />
        </div>
      );
    };

    return (
      <Segment basic className="ui fluid form">
        <Dimmer active={processing} inverted>
          <Loader inverted>Updating</Loader>
        </Dimmer>
        {this.renderField('firstName', toEditableInput('firstName', 'firstName'))}
        <div className="mb2" />
        {this.renderField('lastName', toEditableInput('lastName', 'lastName'))}
        <div className="mb2" />
        {this.adminMode && this.renderField('userRole')}
        {this.adminMode && this.renderUserRoleSelection()}
        <div className="mb2" />
        {this.adminMode && this.renderField('identityProviderName')}
        {this.adminMode && this.renderIdentityProviderNameSelection()}
        <div className="mb2" />
        {this.adminMode && this.props.userRolesStore.getUserType(this.state.userRole) === 'INTERNAL' ? (
          <div>
            {this.renderField('raasProjectId')}
            {this.renderraasProjectIdSelection()}
          </div>
        ) : (
          ''
        )}
        <div className="mb2" />
        {this.adminMode && this.renderField('status')}
        {this.adminMode && this.renderStatusSelection()}
        {this.renderButtons()}
        <div className="mb4" />
      </Segment>
    );
  }

  handleClickEditButton = () => {
    this.setState({ view: 'edit' });
  };

  hasAWSCredentials = () => this.props.userStore.user.isExternalUser && this.props.userStore.user.hasCredentials;

  handleClickResetButton = async () => {
    runInAction(() => {
      this.formProcessing = true;
    });
    try {
      await this.props.userStore.user.clearEncryptedCreds();
      await this.props.usersStore.updateUser(this.props.userStore.user);
      await this.props.userStore.load();
      runInAction(() => {
        this.formProcessing = false;
      });
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(error);
    }
  };

  handleClickCancelButton = () => {
    this.setState({ view: 'detail' });
  };

  handleStatusChange = (e, { value }) => this.setState({ status: value });

  handleUserRoleSelection = (e, { value }) => {
    this.setState({ userRole: value });
    if (this.props.userRolesStore.getUserType(this.state.userRole) === 'EXTERNAL') {
      this.setState({ raasProjectId: [] });
    }
  };

  handleRaasProjectId = (e, { value }) => this.setState({ raasProjectId: value });

  handleIdentityProviderName = (e, { value }) => {
    this.setState({
      identityProviderName: value,
    });
  };

  renderUserRoleSelection() {
    const userRoleOption = this.props.userRolesStore.dropdownOptions;
    return (
      <Dropdown
        options={userRoleOption}
        defaultValue={this.state.userRole}
        placeholder={'Please select user role'}
        fluid
        selection
        onChange={this.handleUserRoleSelection}
      />
    );
  }

  renderraasProjectIdSelection() {
    const raasProjects = this.props.raasProjectsStore.dropdownOptions;
    return (
      <Dropdown
        options={raasProjects}
        fluid
        multiple
        selection
        onChange={this.handleRaasProjectId}
        defaultValue={this.state.raasProjectId}
      />
    );
  }

  renderStatusSelection() {
    return (
      <Form>
        <Form.Field>
          <Radio
            label="Active"
            name="radioGroup"
            value="active"
            checked={this.state.status === 'active'}
            onChange={this.handleStatusChange}
          />
        </Form.Field>
        <Form.Field>
          <Radio
            label="Inactive"
            name="radioGroup"
            value="inactive"
            checked={this.state.status === 'inactive'}
            onChange={this.handleStatusChange}
          />
        </Form.Field>
      </Form>
    );
  }

  renderIdentityProviderNameSelection() {
    const identityProviderOption = [
      {
        key: 'auth0',
        text: 'Auth0 Database',
        value: 'auth0',
      },
      {
        key: 'google-oauth2',
        text: 'Google',
        value: 'google-oauth2',
      },
    ];
    return (
      <Dropdown
        options={identityProviderOption}
        fluid
        selection
        onChange={this.handleIdentityProviderName}
        defaultValue={this.currentUser.identityProviderName}
      />
    );
  }

  handleClickSubmitButton = action(async () => {
    if (_.isEmpty(this.updateUser.firstName)) {
      this.updateUser.firstName = this.currentUser.firstName;
    }
    if (_.isEmpty(this.updateUser.lastName)) {
      this.updateUser.lastName = this.currentUser.lastName;
    }
    this.formProcessing = true;
    try {
      // Perform client side validations first
      const validationResult = await validate(this.updateUser, this.getUpdateUserConfigFormFields);
      // if there are any client side validation errors then do not attempt to make API call
      if (validationResult.fails()) {
        runInAction(() => {
          this.validationErrors = validationResult.errors;
          this.formProcessing = false;
        });
      } else {
        // There are no client side validation errors so ask the store to add user (which will make API call to server to add the user)
        let deletedUser = _.clone(this.currentUser);
        this.currentUser.firstName = this.updateUser.firstName;
        this.currentUser.lastName = this.updateUser.lastName;

        const isExternalUser = this.props.userRolesStore.getUserType(this.state.userRole) === 'EXTERNAL';
        this.currentUser.isExternalUser = isExternalUser;
        if (this.adminMode) {
          this.currentUser.userRole = this.state.userRole;
          this.currentUser.status = this.state.status;
          this.currentUser.raasProjectId = this.state.raasProjectId;

          this.currentUser.isAdmin = this.state.userRole === 'admin';
          if (isExternalUser) {
            this.currentUser.raasProjectId = [];
          }
        }

        if (this.currentUser.identityProviderName === this.state.identityProviderName) {
          try {
            if (this.adminMode) {
              this.currentUser.identityProviderName = this.state.identityProviderName;
            }
            await this.props.usersStore.updateUser(this.currentUser);
            await this.props.userStore.load();
            runInAction(() => {
              this.formProcessing = false;
            });
            this.cleanUp();
          } catch (err) {
            runInAction(() => {
              this.formProcessing = false;
            });
            displayError(err);
          }
        } else {
          try {
            if (this.adminMode) {
              this.currentUser.identityProviderName = this.state.identityProviderName;
            }
            await this.getStore().addUser(this.currentUser);
            await this.getStore().deleteUser(deletedUser);
            await this.getStore().load();
            runInAction(() => {
              this.formProcessing = false;
            });
          } catch (err) {
            runInAction(() => {
              this.formProcessing = false;
            });
            displayError(err);
          }
        }
      }
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(error);
    }
    if (this.props.userStore.username === this.props.user.username) {
      // if this is the same user, update the user store
      this.props.userStore.load();
    }
  });

  handleClickDeleteButton = action(async () => {
    runInAction(() => {
      this.formProcessing = true;
    });
    try {
      await this.getStore().deleteUser(this.currentUser);
      runInAction(() => {
        this.formProcessing = false;
      });
      this.cleanUp();
    } catch (error) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(error);
    }
  });

  handleClickApproveButton = action(async () => {
    runInAction(() => {
      this.formProcessing = true;
    });
    try {
      if (this.adminMode) {
        this.currentUser.status = 'active';
      }
      await this.props.usersStore.updateUser(this.currentUser);
      await this.props.userStore.load();
      runInAction(() => {
        this.formProcessing = false;
      });
      this.cleanUp();
    } catch (err) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(err);
    }
    this.cleanUp();
  });

  handleClickDeactivateButton = action(async () => {
    runInAction(() => {
      this.formProcessing = true;
    });
    try {
      if (this.adminMode) {
        this.currentUser.status = 'inactive';
      }
      await this.props.usersStore.updateUser(this.currentUser);
      await this.props.userStore.load();
      runInAction(() => {
        this.formProcessing = false;
      });
      this.cleanUp();
    } catch (err) {
      runInAction(() => {
        this.formProcessing = false;
      });
      displayError(err);
    }
    this.cleanUp();
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

    const editButton =
      this.state.view === 'detail' && (this.props.user.status === 'active' || this.props.user.status === 'inactive')
        ? makeButton({ label: 'Edit', onClick: this.handleClickEditButton })
        : '';

    const saveButton =
      this.state.view === 'edit' ? makeButton({ label: 'Save', onClick: this.handleClickSubmitButton }) : '';

    const deleteButton =
      this.state.view === 'detail'
        ? makeButton({ label: 'Delete', floated: 'right', onClick: this.handleClickDeleteButton })
        : '';

    const activeButton =
      (this.props.user.status === 'pending' || this.props.user.status === 'inactive') && this.state.view === 'detail'
        ? makeButton({
            label: 'Activate User',
            floated: 'right',
            color: 'blue',
            onClick: this.handleClickApproveButton,
          })
        : '';

    const deactiveButton =
      (this.props.user.status === 'active' || this.props.user.status === 'pending') && this.state.view === 'detail'
        ? makeButton({ label: 'Deactivate User', floated: 'right', onClick: this.handleClickDeactivateButton })
        : '';

    const cancelButton =
      this.state.view === 'edit'
        ? makeButton({ label: 'Cancel', floated: 'right', onClick: this.handleClickCancelButton })
        : '';

    const resetButton =
      this.state.view === 'detail' && this.hasAWSCredentials()
        ? makeButton({ label: 'Reset AWS Credentials', onClick: this.handleClickResetButton })
        : '';

    return this.adminMode ? (
      <div className="mt3 mb3">
        <Modal.Actions>
          {cancelButton}
          {deactiveButton}
          {activeButton}
          {deleteButton}
          {saveButton}
          {editButton}
        </Modal.Actions>
      </div>
    ) : (
      <div className="mt3 mb3">
        <Modal.Actions>
          {cancelButton}
          {saveButton}
          {editButton}
          {resetButton}
        </Modal.Actions>
      </div>
    );
  }

  renderField(name, component, contentRenderer) {
    const fields = this.getUpdateUserConfigFormFields;
    const explain = fields[name].explain;
    const label = fields[name].label;
    const hasExplain = !_.isEmpty(explain);
    let content = this.currentUser[name];
    if (contentRenderer && typeof contentRenderer === 'function') {
      content = contentRenderer(content);
    }
    content = _.isEmpty(content) ? 'N/A' : content;

    const fieldErrors = this.validationErrors.get(name);
    const hasError = !_.isEmpty(fieldErrors);
    return (
      <div>
        <Header className="mr3 mt0" as="h4" color="grey">
          {label}
        </Header>
        {hasExplain && (
          <div className="mb2">
            {explain} <span>{this.state.view === 'detail' ? content : ''}</span>
          </div>
        )}
        <div className={`ui field input block m0 ${hasError ? 'error' : ''}`}>{component}</div>
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

  getStore() {
    return this.props.usersStore;
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(UserConfigure, {
  formProcessing: observable,
  user: observable,
  validationErrors: observable,
});
export default observer(UserConfigure);
