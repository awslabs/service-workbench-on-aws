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

import _ from 'lodash';
import { createForm } from '@aws-ee/base-ui/dist/helpers/form';

const editWorkflowTemplateDraftMetaFields = (templateVersion) => {
  const { title = '', desc = '', instanceTtl, runSpec = {}, propertyOverrideSummaryRows = [] } = templateVersion;
  const result = [
    {
      name: 'templateTitle',
      label: 'Workflow Template Title',
      placeholder: 'Type a title for the workflow template',
      extra: {
        explain: `This is a required field and the number of characters must be between 3 and 255.
      The title is shown in many places in the UI.`,
      },
      value: title,
      rules: 'required|string|between:3,255',
    },

    {
      name: 'templateDesc',
      label: 'Workflow Template Description',
      placeholder: 'Type a description for the workflow template',
      extra: {
        explain: `The description can be written in markdown but must be between 3 and 4000 characters.`,
      },
      value: desc,
      rules: 'required|string|between:3,4000',
    },

    {
      name: 'instanceTtl',
      label: 'Time to Live (TTL) for instances of the workflow',
      placeholder: 'Type the number of days',
      extra: {
        explain: `The number of days for which a record of a workflow instance is kept in the database.
      Leave it empty or type -1 if you don't want to have a time limit on the record.`,
      },
      value: instanceTtl,
      rules: 'integer',
    },

    {
      name: 'runSpecSize',
      label: 'Runtime lambda size',
      extra: {
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
    },

    {
      name: 'runSpecTarget',
      label: 'Runtime target',
      extra: {
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
    },
  ];

  const propsOverrideFields = _.map(propertyOverrideSummaryRows, ({ name, title_, allowed = false }) => ({
    name: `propsOverride_${name}`,
    label: title_,
    value: allowed,
    default: allowed,
  }));

  return [...result, ...propsOverrideFields];
};

function getEditWorkflowTemplateDraftMetaForm(template) {
  const fields = editWorkflowTemplateDraftMetaFields(template);

  return createForm(fields);
}

export default getEditWorkflowTemplateDraftMetaForm;
