/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

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
