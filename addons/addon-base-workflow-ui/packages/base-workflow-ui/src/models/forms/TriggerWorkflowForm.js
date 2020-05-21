import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const triggerWorkflowFields = [
  {
    name: 'workflowInput',
    label: 'Workflow Input',
    placeholder: 'Provide a JSON input',
    extra: {
      explain: `This is an advance operation. You will need to provide an input in the form of a json object.`,
    },
    rules: 'string',
  },
];

function getTriggerWorkflowForm() {
  return createForm(triggerWorkflowFields);
}

export default getTriggerWorkflowForm;
