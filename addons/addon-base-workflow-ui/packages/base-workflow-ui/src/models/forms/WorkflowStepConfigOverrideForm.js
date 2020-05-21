import _ from 'lodash';
import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const workflowStepConfigOverrideFields = step => {
  const rows = step.configOverrideSummaryRows || [];
  return _.map(rows, ({ name, title, allowed = false }) => ({
    name,
    label: title,
    value: allowed,
    default: allowed,
  }));
};

function getWorkflowStepConfigOverrideForm(step) {
  const fields = workflowStepConfigOverrideFields(step);
  return createForm(fields);
}

export default getWorkflowStepConfigOverrideForm;
