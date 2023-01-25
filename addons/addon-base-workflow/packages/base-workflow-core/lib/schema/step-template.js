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
  "definitions": {
    "markdown": {
      "type": "string"
    },
    "description": {
      "$ref": "#/definitions/markdown"
    },
    "manifestCondition": {
      "oneOf": [{ "type": "null" }, { "type": "string", "default": "" }]
    },
    "manifestEntryInput": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "type": {
          "type": "string",
          "enum": [
            "yesNoInput",
            "stringInput",
            "dropDownInput",
            "textAreaInput",
            "userSelectionInput",
            "workflowSelectionInput"
          ]
        },
        "condition": { "$ref": "#/definitions/manifestCondition" },
        "title": { "type": "string" },
        "desc": { "$ref": "#/definitions/description" },
        "rules": { "type": "string" },
        "nonInteractive": { "type": "boolean", "default": true },
        "sensitive": { "type": "boolean", "default": false },
        "divider": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "icon": { "type": "string" }
          },
          "additionalProperties": false
        },
        "yesLabel": { "type": "string" },
        "noLabel": { "type": "string" },
        "options": {
          "typ": "array"
        },
        "extra": {
          "type": "object"
        }
      },
      "required": [
        "name",
        "type",
        "title"
      ]
    },
    "manifestEntrySegment": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "type": { "type": "string", "enum": ["segment"] },
        "condition": { "$ref": "#/definitions/manifestCondition" },
        "raised": { "type": "boolean", "default": false },
        "basic": { "type": "boolean", "default": false },
        "ribbon": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "color": { "type": "string" }
          },
          "additionalProperties": false
        },
        "children": {
          "type": "array",
          "items": { "$ref": "#/definitions/inputEntryManifest" },
          "default": []
        }
      },
      "required": [
        "type",
        "children"
      ]
    },
    "inputEntryManifest": {
      "type": "object",
      "oneOf": [{ "$ref": "#/definitions/manifestEntrySegment" }, { "$ref": "#/definitions/manifestEntryInput" }]
    },
    "inputSectionManifest": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "condition": { "$ref": "#/definitions/manifestCondition" },
        "children": {
          "type": "array",
          "items": { "$ref": "#/definitions/inputEntryManifest" },
          "default": []
        }
      },
      "required": [
        "children"
      ]
    },
    "inputManifest": {
      "type": "object",
      "properties": {
        "sections": { "typ": "array", "items": { "$ref": "#/definitions/inputSectionManifest" }, "default": [] }
      }
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://basedl/root.json",
  "type": "object",
  "required": [
    "id",
    "v",
    "title",
    "desc",
    "skippable",
    "hidden"
  ],
  "additionalProperties": false,
  "properties": {
    "id": {
      "$id": "#/properties/id",
      "type": "string",
      "pattern": "^(.*)$"
    },
    "v": {
      "$id": "#/properties/v",
      "type": "integer",
      "minimum": 0
    },
    "title": {
      "$id": "#/properties/title",
      "type": "string",
      "default": "",
      "pattern": "^(.*)$"
    },
    "desc": {
      "$ref": "#/definitions/description"
    },
    "skippable": {
      "$id": "#/properties/skippable",
      "type": "boolean",
      "default": false
    },
    "src": {
      "$id": "#/properties/src",
      "type": "object",
      "required": [
        "lambdaArn",
        "pluginId"
      ],
      "properties": {
        "lambdaArn": {
          "$id": "#/properties/src/properties/lambdaArn",
          "type": "string"
        },
        "pluginId": {
          "$id": "#/properties/src/properties/pluginId",
          "type": "string"
        }
      },
      "additionalProperties": false
    },
    "adminInputManifest": { "$ref": "#/definitions/inputManifest" },
    "inputManifest": { "$ref": "#/definitions/inputManifest" },
    "hidden": { "type": "boolean", "default": false }
  }
}
module.exports = schema;