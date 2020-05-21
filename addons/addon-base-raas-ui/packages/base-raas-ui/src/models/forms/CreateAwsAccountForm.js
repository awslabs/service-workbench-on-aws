import { createForm } from '../../helpers/form';

const createAwsAccountFormFields = {
  accountName: {
    label: 'Account Name',
    placeholder: 'Type the name of this account',
    rules: 'required|string|between:1,100',
  },
  accountEmail: {
    label: 'AWS Account Email',
    placeholder: 'Type AWS account email',
    rules: 'required|string|email',
  },
  masterRoleArn: {
    label: 'Master Role Arn',
    placeholder: 'Type configured Role ARN of master account of the Organization',
    rules: 'required|string|between:10,300',
  },
  externalId: {
    label: 'External ID',
    placeholder: 'Type external ID for this AWS account',
    rules: 'required|string|between:1,300',
  },
  description: {
    label: 'Description',
    placeholder: 'Type description for this AWS account',
    rules: 'required|string',
  },
};

function getCreateAwsAccountFormFields() {
  return createAwsAccountFormFields;
}

function getCreateAwsAccountForm() {
  return createForm(createAwsAccountFormFields);
}

export { getCreateAwsAccountFormFields, getCreateAwsAccountForm };
