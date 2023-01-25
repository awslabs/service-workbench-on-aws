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
  definitions: {
    permissionLevel: {
      type: "string",
      enum: ["admin", "readonly", "writeonly", "readwrite"]
    },
    userEntry: {
      type: "object",
      properties: {
        uid: { "type": "string" },
        permissionLevel: { "$ref": "#/definitions/permissionLevel" }
      },
      required: ["uid"]
    }
  },
  properties: {
    usersToAdd: {
      type: "array",
      items: { "$ref": "#/definitions/userEntry" }
    },
    usersToRemove: {
      type: "array",
      items: { "$ref": "#/definitions/userEntry" }
    }
  }
}
module.exports = schema;