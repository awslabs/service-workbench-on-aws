import { createForm } from '../../helpers/form';

const addUserFormFields = {
  email: {
    label: 'Username',
    placeholder: 'Type email address as username for the user',
    extra: { explain: 'Username in email format' },
    rules: 'required|email|string',
  },
  identityProviderName: {
    label: 'Identity Provider',
    extra: { explain: 'Identity Provider for this user' },
  },
  projectId: {
    label: 'Project Id',
    extra: { explain: 'Select Project for this user' },
  },
  userRole: {
    label: 'UserRole',
    extra: { explain: "Select user's role" },
  },
  status: {
    label: 'Status',
    extra: {
      explain: 'Active users can log into the Research Portal',
      yesLabel: 'Active',
      noLabel: 'Inactive',
      yesValue: 'active',
      noValue: 'inactive',
    },
  },
};

function getAddUserFormFields() {
  return addUserFormFields;
}

function getAddUserForm() {
  return createForm(addUserFormFields);
}

export { getAddUserFormFields, getAddUserForm };
