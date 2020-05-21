import { createForm } from '../../helpers/form';

const addIndexFormFields = {
  id: {
    label: 'Index ID',
    placeholder: 'Type id for this index',
    rules: 'required|string|between:1,300',
  },
  awsAccountId: {
    label: 'AWS Account ID',
  },
  description: {
    label: 'Description',
    placeholder: 'Type description for this index',
    rules: 'string|between:1,3000',
  },
};

function getAddIndexFormFields() {
  return addIndexFormFields;
}

function getAddIndexForm() {
  return createForm(addIndexFormFields);
}

export { getAddIndexFormFields, getAddIndexForm };
