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
    // Name for this key-pair
    name: {
      type: 'string',
      maxLength: 100,
      minLength: 2,
      pattern: '^[A-Za-z0-9-_ ]+$',
    },
    // Description for this key-pair
    desc: {
      type: 'string',
      maxLength: 1024,
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive'],
    },

    // optionally associate key-pair to some user
    uid: {
      type: 'string',
    },

    // optionally, provide your own public key
    publicKey: {
      type: 'string',
    },
  },
  required: ['name'],
};

module.exports = schema;
