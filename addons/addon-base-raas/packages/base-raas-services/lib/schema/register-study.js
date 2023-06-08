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

const { idRegex, nonHtmlRegex } = require('@amzn/base-services/lib/helpers/constants');

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: idRegex,
    },
    name: {
      type: 'string',
      maxLength: 300,
      pattern: nonHtmlRegex,
    },
    category: {
      type: 'string',
      enum: ['My Studies', 'Organization'],
    },
    description: {
      type: 'string',
      maxLength: 2048,
      pattern: nonHtmlRegex,
    },
    projectId: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: idRegex,
    },
    folder: {
      type: 'string',
      minLength: 1,
      maxLength: 1000,
      pattern: '^([^<>{}*?]+)$',
    },
    kmsArn: {
      type: 'string',
      maxLength: 90,
      pattern: 'arn:aws[a-zA-Z-]*:kms:[a-z]{2}((-gov)|(-iso(b?)))?-[a-z]+-[0-9]{1}:[0-9]{12}:key[/]{1}[a-zA-Z0-9-]+',
    },
    kmsScope: {
      enum: ['bucket', 'study', 'none'],
    },
    adminUsers: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    accessType: {
      type: 'string',
      enum: ['readonly', 'readwrite'],
    },
  },
  required: ['id', 'category', 'folder', 'accessType', 'adminUsers', 'projectId'],
};
module.exports = schema;
