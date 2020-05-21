import { createForm } from '../../helpers/form';

function getExternalUserPinFormFields() {
  return [
    {
      name: 'pin',
      label: 'PIN',
      placeholder: 'A PIN or password to secure your IAM credentials',
      rules: 'required|string|between:4,16',
    },
  ];
}

function getExternalUserPinForm() {
  return createForm(getExternalUserPinFormFields());
}

export { getExternalUserPinForm, getExternalUserPinFormFields };
