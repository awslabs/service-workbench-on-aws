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
const { idRegex } = require('@amzn/base-services/lib/helpers/constants');
const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    projectId: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[A-Za-z0-9-_]+$',
    },
    rev: {
      type: 'number',
      minimum: 0,
    },
    inWorkflow: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      description: 'Mark true for environment in workflow to exclude it from status poll and sync',
    },
    status: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    cidr: {
      type: 'string',
      pattern: '^(?:([0-9]{1,3}\\.){3}[0-9]{1,3}(\\/([0-9]|[1-2][0-9]|3[0-2]))?)?$',
    },
    createdAt: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    updatedBy: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    createdBy: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    studyIds: {
      type: 'array',
      items: [
        {
          type: 'string',
          minLength: 1,
        },
      ],
    },
    updatedAt: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    indexId: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
      pattern: idRegex,
    },
    envTypeConfigId: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    envTypeId: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
    },
    hasConnections: { type: 'boolean' },
    studyRoles: {
      type: 'object',
      properties: {},
      additionalProperties: true,
    },
  },
  required: [
    'projectId',
    'rev',
    'inWorkflow',
    'status',
    'createdAt',
    'updatedBy',
    'createdBy',
    'name',
    'studyIds',
    'updatedAt',
    'indexId',
    'description',
    'id',
    'envTypeConfigId',
    'envTypeId',
    'hasConnections',
  ],
};
module.exports = schema;
