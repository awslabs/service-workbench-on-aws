import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const workflowStepPropsFields = (step, { isTemplate = true } = {}) => {
  const { skippable } = step;
  const propsOverrideOption = step.propsOverrideOption || { allowed: [] };
  const warnMessage = 'The workflow template used by this workflow does not allow you to modify this field';
  const canOverride = prop => isTemplate || propsOverrideOption.allowed.includes(prop);
  const warnIfCanNotOverride = (prop, text = warnMessage) => (canOverride(prop) ? undefined : text);

  return {
    skippable: {
      label: 'Skip this step if pervious steps failed?',
      extra: {
        explain: 'If a previous step failed, should this step still run by the workflow engine?',
        warn: warnIfCanNotOverride('skippable'),
      },
      value: skippable,
      rules: 'required|boolean',
      disabled: !canOverride('skippable'),
    },
  };
};

function getWorkflowStepPropsForm(step, options) {
  const fields = workflowStepPropsFields(step, options);

  return createForm(fields);
}

export default getWorkflowStepPropsForm;
