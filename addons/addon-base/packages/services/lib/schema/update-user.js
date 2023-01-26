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
    uid: {
      type: 'string',
    },
    usernameInIdp: {
      type: 'string',
      format: 'email',
      minLength: 6,
      maxLength: 512,
      pattern:
        '^([^.%+!$&*=^|~#%{}]+)[a-zA-Z0-9\\._%+!$&*=^|~#%{}/\\-]+([^.!]+)@([^-.!](([a-zA-Z0-9\\-]+\\.){1,}([a-zA-Z]{2,63})))',
    },
    email: {
      type: 'string',
      pattern:
        '^([^.%+!$&*=^|~#%{}]+)[a-zA-Z0-9\\._%+!$&*=^|~#%{}/\\-]+([^.!]+)@([^-.!](([a-zA-Z0-9\\-]+\\.){1,}([a-zA-Z]{2,63})))',
    },
    firstName: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      pattern: '^[A-Za-z0-9 .-]+$',
    },
    lastName: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      pattern: '^[A-Za-z0-9 .-]+$',
    },
    userType: {
      type: 'string',
      enum: ['root'],
    },
    isSamlAuthenticatedUser: {
      type: 'boolean',
    },
    isNativePoolUser: {
      type: 'boolean',
      default: false,
    },
    isAdmin: {
      type: 'boolean',
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive'],
    },
    rev: {
      type: 'number',
      minimum: 0,
    },
  },
  required: ['uid', 'rev'],
};
module.exports = schema;
