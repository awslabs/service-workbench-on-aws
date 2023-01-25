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
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      maxLength: 128,
      minLength: 3,
      pattern: "^[A-Za-z][A-Za-z0-9-]+$"
    },
    platformId: {
      type: "string",
      minLength: 1,
      maxLength: 100
    },
    configurationId: {
      type: "string",
      minLength: 1,
      maxLength: 300
    },
    description: {
      type: "string",
      maxLength: 2048
    },
    accountId: {
      type: "string",
      minLength: 12
    },
    projectId: {
      type: "string"
    },
    params: {
      type: "object",
      additionalProperties: true
    },
    studyIds: {
      type: "array",
      items: [
        {
          type: "string",
          minLength: 1
        }
      ]
    },
    sharedWithUsers: {
      type: "array",
      items: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            username: {
              type: "string",
              minLength: 3
            },
            ns: {
              type: "string",
              minLength: 3
            }
          }
        }
      ],
      default: []
    }
  },
  required: ["name", "platformId", "configurationId"]
}
module.exports = schema;