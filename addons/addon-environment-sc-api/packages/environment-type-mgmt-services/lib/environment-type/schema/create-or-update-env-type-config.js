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

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
      minLength: 2,
      pattern: '^[A-Za-z0-9-_]+$',
    },
    name: {
      type: 'string',
      maxLength: 128,
      minLength: 2,
      pattern: '^[A-Za-z0-9-_ ]+$',
    },
    desc: {
      type: 'string',
      maxLength: 8191,
      pattern: '^([^<>{}]*)$',
    },
    // A string explaining estimated cost
    estimatedCostInfo: {
      type: 'string',
      maxLength: 1024,
      pattern: '^([^<>{}]*)$',
    },
    allowRoleIds: {
      type: 'array',
      items: [
        {
          type: 'string',
          maxLength: 100,
          pattern: '^[A-Za-z0-9-_ ]+$',
        },
      ],
    },
    denyRoleIds: {
      type: 'array',
      items: [
        {
          type: 'string',
          maxLength: 100,
          pattern: '^[A-Za-z0-9-_ ]+$',
        },
      ],
    },

    // An array of param mapping objects containing mapping of CFN parameters to
    // values or to dynamic variable expressions
    params: {
      type: 'array',
      items: [
        {
          type: 'object',
          properties: {
            key: {
              type: 'string', // The name of the CFN parameter
              maxLength: 8191,
              pattern: '^([^<>{}]*)$',
            },
            value: {
              type: 'string', // The value for the CFN param or variable expression such as ${vpcId} that will be resolved at the time of launching envs
              maxLength: 8191,
              pattern: '^([^<>]+)$',
            },
          },
        },
      ],
    },

    // Optional array of tags to be applied to the product stack when it
    // is launched
    tags: {
      type: 'array',
      items: [
        {
          type: 'object',
          properties: {
            key: {
              type: 'string', // Tag name
              maxLength: 8191,
              pattern: '^([^<>{}]*)$',
            },
            value: {
              type: 'string', // Tag value
              maxLength: 8191,
              pattern: '^([^<>{}]*)$',
            },
          },
        },
      ],
    },
  },
  required: ['id', 'name'],
};

module.exports = schema;
