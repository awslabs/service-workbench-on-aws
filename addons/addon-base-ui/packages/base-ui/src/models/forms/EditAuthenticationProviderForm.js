import { createForm } from '../../helpers/form';

const formFields = {
  title: {
    label: 'Authentication Provider Title',
    extra: {
      explain: 'This is a required field and the number of characters must be between 3 and 255. ',
    },
    placeholder: 'Type a title for the Authentication Provider',
    rules: 'required|between:3,255',
  },
  desc: {
    label: 'Authentication Provider Description',
    placeholder: 'Type a description of the Authentication Provider',
    extra: {
      explain:
        'The Authentication Provider description helps other administrators understand the details about the authentication provider. ' +
        'The description can have a maximum of 2048 characters.',
    },
    rules: 'max:2048',
  },
};

function getEditAuthenticationProviderFormFields() {
  return formFields;
}

function getEditAuthenticationProviderForm(fields = formFields) {
  return createForm(fields);
}

export { getEditAuthenticationProviderForm, getEditAuthenticationProviderFormFields };
