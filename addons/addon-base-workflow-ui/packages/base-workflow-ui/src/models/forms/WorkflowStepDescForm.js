import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const workflowStepDescFields = (step, { isTemplate = true } = {}) => {
  const { title = '', desc = '', derivedTitle = '', derivedDesc = '' } = step;
  const propsOverrideOption = step.propsOverrideOption || { allowed: [] };
  const warnMessage = 'The workflow template used by this workflow does not allow you to modify this field';
  const canOverride = prop => isTemplate || propsOverrideOption.allowed.includes(prop);
  const warnIfCanNotOverride = (prop, text = warnMessage) => (canOverride(prop) ? undefined : text);

  return {
    stepTitle: {
      label: 'Title',
      placeholder: 'Type a title for the step',
      extra: {
        explain: `This is a required field and the number of characters must be between 3 and 255.
        The title is shown in many places in the UI.`,
        warn: warnIfCanNotOverride('title'),
      },
      value: title || derivedTitle,
      rules: 'required|string|between:3,255',
      disabled: !canOverride('title'),
    },

    stepDesc: {
      label: 'Description',
      placeholder: 'Type a description for the step',
      extra: {
        explain: `The description can be written in markdown but must be between 3 and 4000 characters.`,
        warn: warnIfCanNotOverride('desc'),
      },
      value: desc || derivedDesc,
      rules: 'required|string|between:3,4000',
      disabled: !canOverride('desc'),
    },
  };
};

function getWorkflowStepDescForm(step, options) {
  const fields = workflowStepDescFields(step, options);
  return createForm(fields);
}

export default getWorkflowStepDescForm;
