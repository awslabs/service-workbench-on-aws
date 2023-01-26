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
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      minLength: 1,
      maxLength: 100,
      pattern: idRegex
    },
    rev: {
      type: "number",
      minimum: 0
    },
    name: {
      type: "string",
      minLength: 1,
      maxLength: 300,
      pattern: nonHtmlRegex
    },
    description: {
      type: "string",
      description: "Leaving length and pattern blank to accommodate open data"
    },
    sha: {
      type: "string",
      maxLength: 64,
      pattern: "^([A-Fa-f0-9]{40})$",
      description: "A unique identifier for Open Data in MD5 hash, hexadecimal"
    },
    appRoleArn: {
      type: "string",
      maxLength: 2048,
      pattern: "^(arn:aws[a-zA-Z-]*:iam::[0-9]{12}:role[/]{1}[a-zA-Z0-9-]+)$"
    },
    resources: {
      type: "array",
      items: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            arn: {
              type: "string",
              maxLength: 2048,
              pattern: "^(arn:aws[a-zA-Z-]*:[a-zA-Z0-9-/.:_?*]+)$"
            },
            fileShareArn: {
              type: "string",
              maxLength: 2048,
              pattern: "^(arn:aws[a-zA-Z-]*:[a-zA-Z0-9-/.:_?*]+)$"
            }
          }
        }
      ]
    }
  },
  required: ["id"]
}
module.exports = schema;