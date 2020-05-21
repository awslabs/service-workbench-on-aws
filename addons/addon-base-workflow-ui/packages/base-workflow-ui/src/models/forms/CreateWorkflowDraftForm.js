import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const createWorkflowDraftFields = [
  {
    name: 'draftFor',
    label: 'Draft For',
    placeholder: 'Select one',
    rules: 'required|in:newWorkflow,existingWorkflow',
  },
  {
    name: 'templateId',
    label: 'Workflow Template',
    placeholder: 'Select a workflow template to start from',
    extra: {
      explain: `To create a workflow, you need to select an existing workflow template as a starting point.`,
    },
    rules: 'required|string|between:3,150|alpha_dash',
  },
  {
    name: 'workflowId',
    label: 'Workflow Id',
    placeholder: 'Type a unique id for this workflow',
    extra: {
      explain: `This is a required field and the number of characters must be between 3 and 100 and no spaces. Only
    alpha-numeric characters and dashes are allowed. Once a draft is created you can not change the workflow id.`,
    },
    rules: 'required|string|between:3,100|alpha_dash',
  },
];

function getCreateDraftForm() {
  return createForm(createWorkflowDraftFields);
}

export default getCreateDraftForm;
