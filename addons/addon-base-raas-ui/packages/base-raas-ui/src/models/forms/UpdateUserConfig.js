import _ from 'lodash';
import { createForm } from '../../helpers/form';

function getUpdateUserConfigFormFields(existingUser) {
  return {
    username: {
      label: 'Username',
      value: _.get(existingUser, 'username', ''),
    },
    firstName: {
      label: 'First Name',
      placeholder: 'First name of this user',
      value: _.get(existingUser, 'firstName', ''),
      rules: 'required|string',
    },
    lastName: {
      label: 'Last Name',
      placeholder: 'Last name of this user',
      value: _.get(existingUser, 'lastName', ''),
      rules: 'required|string',
    },
    email: {
      label: 'Email',
      placeholder: 'email address',
      value: _.get(existingUser, 'email', ''),
      rules: 'required|email|string',
    },
    identityProviderName: {
      label: 'Identity Provider Name',
      value: _.get(existingUser, 'identityProviderName', ''),
    },
    projectId: {
      label: 'Project',
      value: _.get(existingUser, 'projectId', ''),
    },
    userRole: {
      label: 'User Role',
      value: _.get(existingUser, 'userRole', ''),
    },
    applyReason: {
      label: 'Reason for Applying',
      explain: ' ',
      value: _.get(existingUser, 'applyReason', ''),
    },
    status: {
      label: 'User Status',
      extra: {
        explain: 'Active users can log into the Research Portal',
        yesLabel: 'Active',
        noLabel: 'Inactive',
        yesValue: 'active',
        noValue: 'inactive',
      },
      value: _.get(existingUser, 'status', ''),
    },
  };
}

function getUpdateUserConfigForm(existingUser) {
  return createForm(getUpdateUserConfigFormFields(existingUser));
}

export { getUpdateUserConfigFormFields, getUpdateUserConfigForm };
