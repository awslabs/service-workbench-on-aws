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

const editWorkflowDraftMetaFields = version => {
  const { title = '', desc = '', instanceTtl, runSpec = {} } = version;
  const warnMessage = 'The workflow template used by this workflow does not allow you to modify this field';
  const warnIfCanNotOverride = (prop, text = warnMessage) => (version.canOverrideProp(prop) ? undefined : text);
  const canOverride = prop => version.canOverrideProp(prop);

  const result = [
    {
      name: 'title',
      label: 'Workflow Title',
      placeholder: 'Type a title for the workflow',
      extra: {
        explain: `This is a required field and the number of characters must be between 3 and 255.
      The title is shown in many places in the UI.`,
        warn: warnIfCanNotOverride('title'),
      },
      value: title,
      rules: 'required|string|between:3,255',
      disabled: !canOverride('title'),
    },

    {
      name: 'desc',
      label: 'Workflow Description',
      placeholder: 'Type a description for the workflow',
      extra: {
        explain: `The description can be written in markdown but must be between 3 and 4000 characters.`,
        warn: warnIfCanNotOverride('desc'),
      },
      value: desc,
      rules: 'required|string|between:3,4000',
      disabled: !canOverride('desc'),
    },

    {
      name: 'instanceTtl',
      label: 'Time to Live (TTL) for instances of the workflow',
      placeholder: 'Type the number of days',
      extra: {
        explain: `The number of days for which a record of a workflow instance is kept in the database.
      Leave it empty or type -1 if you don't want to have a time limit on the record.`,
        warn: warnIfCanNotOverride('instanceTtl'),
      },
      value: instanceTtl,
      rules: 'integer',
      disabled: !canOverride('instanceTtl'),
    },

    {
      name: 'runSpecSize',
      label: 'Runtime lambda size',
      extra: {
        warn: warnIfCanNotOverride('runSpecSize'),
        options: [
          {
            value: 'small',
            text: 'Small',
          },
          {
            value: 'medium',
            text: 'Medium',
          },
          {
            value: 'large',
            text: 'Large',
          },
        ],
      },
      value: runSpec.size || 'small',
      rules: 'required|in:small,medium,large',
      disabled: !canOverride('runSpecSize'),
    },

    {
      name: 'runSpecTarget',
      label: 'Runtime target',
      extra: {
        warn: warnIfCanNotOverride('runSpecTarget'),
        options: [
          {
            value: 'stepFunctions',
            text: 'Step Functions',
          },
          {
            value: 'workerLambda',
            text: 'Worker Lambda',
          },
          {
            value: 'inPlace',
            text: 'In Place',
          },
        ],
      },
      value: runSpec.target || 'stepFunctions',
      rules: 'required|in:stepFunctions,workerLambda,inPlace',
      disabled: !canOverride('runSpecTarget'),
    },
  ];

  return [...result];
};

function getEditWorkflowDraftMetaForm(template) {
  const fields = editWorkflowDraftMetaFields(template);

  return createForm(fields);
}

export default getEditWorkflowDraftMetaForm;
