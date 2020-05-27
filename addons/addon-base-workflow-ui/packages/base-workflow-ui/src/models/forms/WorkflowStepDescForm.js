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

const workflowStepDescFields = (step, { isTemplate = true } = {}) => {
  const { title = '', desc = '', derivedTitle = '', derivedDesc = '' } = step;
  const propsOverrideOption = step.propsOverrideOption || { allowed: [] };
  const warnMessage = 'The workflow template used by this workflow does not allow you to modify this field';
  const canOverride = (prop) => isTemplate || propsOverrideOption.allowed.includes(prop);
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
