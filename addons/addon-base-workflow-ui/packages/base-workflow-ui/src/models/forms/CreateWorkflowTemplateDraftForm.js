import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const createWorkflowTemplateDraftFields = {
  templateId: {
    label: 'Workflow Template Id',
    placeholder: 'Type a unique id for this template',
    extra: {
      explain: `This is a required field and the number of characters must be between 3 and 50 and no spaces. Only
      alpha-numeric characters and dashes are allowed. Once a draft is created you can not change the template id.`,
    },
    value: 'tempValue',
    rules: 'required|string|between:3,50|alpha_dash',
  },

  templateTitle: {
    label: 'Workflow Template Title',
    placeholder: 'Type a title for the workflow template',
    extra: {
      explain: `This is a required field and the number of characters must be between 3 and 255.
      The title is shown in many places in the UI.`,
    },
    value: 'tempValue',
    rules: 'required|string|between:3,255',
  },

  draftFor: {
    label: 'Draft For',
    placeholder: 'Select one',
    extra: {
      explain: 'Decide if you want to create a new workflow template or edit an existing one.',
    },
    rules: 'required|string',
  },
};

function getCreateDraftForm() {
  return createForm(createWorkflowTemplateDraftFields);
}

export default getCreateDraftForm;
