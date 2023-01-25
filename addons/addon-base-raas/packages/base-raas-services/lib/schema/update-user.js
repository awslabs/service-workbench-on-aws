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
    email: {
      type: 'string',
      pattern:
        '^([^.%+!$&*=^|~#%{}]+)[a-zA-Z0-9\\._%+!$&*=^|~#%{}/\\-]+([^.!]+)@([^-.!](([a-zA-Z0-9\\-]+\\.){1,}([a-zA-Z]{2,63})))',
    },
    usernameInIdp: {
      type: 'string',
      minLength: 3,
      maxLength: 300,
    },
    firstName: {
      type: 'string',
      maxLength: 500,
    },
    lastName: {
      type: 'string',
      maxLength: 500,
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
      enum: ['active', 'inactive', 'pending'],
    },
    rev: {
      type: 'number',
      minimum: 0,
    },
    userRole: {
      type: 'string',
    },
    projectId: {
      type: 'array',
    },
    isExternalUser: {
      type: 'boolean',
    },
    encryptedCreds: {
      type: 'string',
    },
    applyReason: {
      type: 'string',
    },
  },
  required: ['uid', 'rev'],
};
module.exports = schema;
