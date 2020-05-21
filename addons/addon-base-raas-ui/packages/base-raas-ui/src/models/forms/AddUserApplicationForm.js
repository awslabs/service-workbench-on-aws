import { createForm } from '../../helpers/form';

const addUserApplicationFormFields = {
  email: {
    label: 'Username',
    placeholder: 'Type email address as username for the user',
  },
  firstName: {
    label: 'First Name',
    placeholder: 'Your first name',
    explain: 'Your current default first name is ',
    rules: 'required|string',
  },
  lastName: {
    label: 'Last Name',
    placeholder: 'Your last name',
    explain: 'Your current default last name is ',
    rules: 'required|string',
  },
  applyReason: {
    label: 'Describe Your Research',
    explain: 'Please tell us why you are requesting access to the Research Portal',
    placeholder: 'Why are you requesting access?',
    rules: 'required|string',
  },
};

function getAddUserApplicationFormFields() {
  return addUserApplicationFormFields;
}

function getAddUserApplicationForm() {
  return createForm(addUserApplicationFormFields);
}

export { getAddUserApplicationFormFields, getAddUserApplicationForm };
