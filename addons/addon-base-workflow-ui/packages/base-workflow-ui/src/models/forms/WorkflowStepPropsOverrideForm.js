import _ from 'lodash';
import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const workflowStepPropsOverrideFields = step => {
  const rows = step.propertyOverrideSummaryRows || [];
  return _.map(rows, ({ name, title, allowed = false }) => ({
    name,
    label: title,
    value: allowed,
    default: allowed,
  }));
};

function getWorkflowStepPropsOverrideForm(step) {
  const fields = workflowStepPropsOverrideFields(step);
  return createForm(fields);
}

export default getWorkflowStepPropsOverrideForm;
