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

const { nonHtmlRegex } = require('@amzn/base-services/lib/helpers/constants');

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['id', 'budgetConfiguration'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[A-Za-z0-9-_]+$',
    },
    budgetConfiguration: {
      type: 'object',
      required: ['budgetLimit', 'startDate', 'endDate'],
      properties: {
        budgetLimit: {
          type: 'string',
          maxLength: 512,
          pattern: '^([0-9.]+)$',
        },
        startDate: {
          type: 'integer',
          minimum: 0,
        },
        endDate: {
          type: 'integer',
          minimum: 0,
        },
        thresholds: {
          type: 'array',
          items: {
            type: 'number',
            enum: [50, 70, 80, 90, 100],
          },
        },
        notificationEmail: {
          type: 'string',
          maxLength: 512,
          format: 'email',
        },
      },
      dependencies: {
        thresholds: ['notificationEmail'],
        notificationEmail: ['thresholds'],
      },
      additionalProperties: false,
    },
    description: {
      type: 'string',
      maxLength: 2048,
      pattern: nonHtmlRegex,
    },
  },
  additionalProperties: false,
};
module.exports = schema;
