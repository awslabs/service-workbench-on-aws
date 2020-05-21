import { createForm } from '../../helpers/form';

function getIAMFormFields(isIAMRequired = true) {
  const rulesPrefix = isIAMRequired ? 'required|' : '';
  return [
    {
      name: 'accessKeyId',
      label: 'IAM User Access Key Id',
      placeholder: 'Access Key for your IAM user',
      rules: `${rulesPrefix}string|size:20`,
    },
    {
      name: 'secretAccessKey',
      label: 'IAM User Secret Access Key',
      placeholder: 'Secret access Key for your IAM user',
      rules: `${rulesPrefix}string|size:40`,
    },
    {
      name: 'region',
      label: 'AWS Region',
      placeholder: 'us-east-1',
      rules: `${rulesPrefix}string|regex:/^[a-z]{2}(-gov)?-[a-z]*-\\d$/`,
    },
    {
      name: 'pin',
      label: 'PIN',
      placeholder: 'A PIN or password to secure your IAM credentials',
      rules: 'required|string|between:4,16',
    },
  ];
}

function getExternalUserIAMForm() {
  return createForm(getIAMFormFields());
}

export { getExternalUserIAMForm, getIAMFormFields };
