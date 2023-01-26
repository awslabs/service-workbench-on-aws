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
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: idRegex
    },
    rev: {
      type: 'number',
      minimum: 0,
    },
    description: {
      type: 'string',
      maxLength: 2048,
    },
    userType: {
      type: 'string',
      enum: ['INTERNAL', 'EXTERNAL'],
    },
  },
  required: ['id', 'rev', 'userType'],
};
module.exports = schema;
