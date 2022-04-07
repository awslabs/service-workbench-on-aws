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
import { createForm } from '@amzn/base-ui/dist/helpers/form';

function getEnvTypeConfigForm(envTypeConfig) {
  const fields = {
    id: {
      label: 'Id',
      placeholder: 'Unique identifier for this Configuration',
      extra: {
        explain:
          'Unique identifier for this Configuration. ' +
          'It must be an alpha numeric string between 2 and 128 characters long may contain underscore (_) and/or dash (-).',
      },
      value: _.get(envTypeConfig, 'id', ''),
      rules: ['required', 'min:2', 'max:128', 'regex:/^[A-Za-z0-9-_]+$/'],
    },
    name: {
      label: 'Name',
      placeholder: 'Name for this Configuration',
      extra: {
        explain:
          'Easily identifiable name for this Configuration. ' +
          'It must be an alpha numeric string between 2 and 128 characters long may contain space, underscore (_) and/or dash (-).',
      },
      value: _.get(envTypeConfig, 'name', ''),
      rules: ['required', 'min:2', 'max:128', 'regex:/^[A-Za-z0-9-_ ]+$/'],
    },
    desc: {
      label: 'Description',
      placeholder: 'Description for this Configuration',
      extra: { explain: 'Description for this Configuration. Markdown syntax is supported' },
      value: _.get(envTypeConfig, 'desc', ''),
      rules: 'max:8191|string',
    },
    estimatedCostInfo: {
      label: 'Estimate Costs',
      placeholder: 'Information about estimated costs when using this Configuration',
      extra: {
        explain: 'Provide information about estimated cost. Markdown syntax is supported',
      },
      value: _.get(envTypeConfig, 'estimatedCostInfo', ''),
      rules: 'max:1024|string',
    },
    allowRoleIds: {
      label: 'Roles Allowed',
      extra: {
        explain: 'User roles allowed to launch workspaces with this Configuration',
      },
      value: _.get(envTypeConfig, 'allowRoleIds', []),
    },
    denyRoleIds: {
      label: 'Roles Not Allowed',
      extra: {
        explain: 'User roles not allowed to launch workspaces with this Configuration',
      },
      value: _.get(envTypeConfig, 'denyRoleIds', []),
    },

    // The params field is not rendered directly, the InputParamsStep renders other form specifically for CFN
    // input params and dynamically sets this field value on submit of that form
    // This field is not used directly for display
    params: {
      label: 'AWS CloudFormation Input Params',
      value: JSON.stringify(_.get(envTypeConfig, 'params', [])),
    },

    // The tags field is not rendered directly, the TagsStep renders other form specifically for tags and dynamically
    // sets this field value on submit of that form
    // This field is not used directly for display
    tags: {
      label: 'Resource Tags',
      value: JSON.stringify(_.get(envTypeConfig, 'tags', [])),
    },
  };

  return createForm(fields);
}

// eslint-disable-next-line import/prefer-default-export
export { getEnvTypeConfigForm };
