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
const schema =
{
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  definitions: {
    s3Info: {
      type: "object",
      additionalProperties: false,
      properties: {
        bucket: {
          type: "string",
          minLength: 1,
          maxLength: 1024
        },
        key: {
          type: "string",
          minLength: 1,
          maxLength: 1024
        }
      },
      required: ["bucket", "key"]
    }
  },

  properties: {
    from: {
      "$ref": "#/definitions/s3Info"
    },
    to: {
      "$ref": "#/definitions/s3Info"
    }
  },
  required: ["from", "to"]
}
module.exports = schema;