import { createForm } from '../../helpers/form';

const addProjectFormFields = {
  id: {
    label: 'Project ID',
    placeholder: 'Type id for this project',
    rules: 'required|string|between:1,300',
  },
  indexId: {
    label: 'Index ID',
  },
  description: {
    label: 'Description',
    placeholder: 'Type description for this project',
    rules: 'string|between:1,3000',
  },
};

function getAddProjectFormFields() {
  return addProjectFormFields;
}

function getAddProjectForm() {
  return createForm(addProjectFormFields);
}

export { getAddProjectFormFields, getAddProjectForm };
