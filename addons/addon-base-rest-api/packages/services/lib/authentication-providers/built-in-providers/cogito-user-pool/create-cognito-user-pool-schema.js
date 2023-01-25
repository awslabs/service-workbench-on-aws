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
  "definitions": {},
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://example.com/root.json",
  "type": "object",
  "required": [
    "title"
  ],
  "additionalProperties": false,
  "properties": {
    "id": {
      "$id": "#/properties/id",
      "type": "string"
    },
    "title": {
      "$id": "#/properties/title",
      "type": "string"
    },
    "userPoolName": {
      "$id": "#/properties/userPoolName",
      "type": "string"
    },
    "userPoolId": {
      "$id": "#/properties/userPoolId",
      "type": "string"
    },
    "clientName": {
      "$id": "#/properties/clientName",
      "type": "string"
    },
    "clientId": {
      "$id": "#/properties/clientId",
      "type": "string"
    },
    "userPoolDomain": {
      "$id": "#/properties/userPoolDomain",
      "type": "string"
    },
    "signInUri": {
      "$id": "#/properties/signInUri",
      "type": "string"
    },
    "authCodeTokenExchangeUri": {
      "$id": "#/properties/authCodeTokenExchangeUri",
      "type": "string"
    },
    "baseAuthUri": {
      "$id": "#/properties/baseAuthUri",
      "type": "string"
    },
    "signOutUri": {
      "$id": "#/properties/signOutUri",
      "type": "string"
    },
    "enableNativeUserPoolUsers": {
      "$id": "#/properties/enableNativeUserPoolUsers",
      "type": "boolean"
    },
    "federatedIdentityProviders": {
      "$id": "#/properties/providerConfig/properties/federatedIdentityProviders",
      "type": "array",
      "items": {
        "$id": "#/properties/providerConfig/properties/federatedIdentityProviders/items",
        "type": "object",
        "title": "The Items Schema",
        "required": [
          "id",
          "name",
          "metadata"
        ],
        "properties": {
          "id": {
            "$id": "#/properties/federatedIdentityProviders/properties/id",
            "type": "string"
          },
          "name": {
            "$id": "#/properties/federatedIdentityProviders/properties/name",
            "type": "string"
          },
          "displayName": {
            "$id": "#/properties/federatedIdentityProviders/properties/displayName",
            "type": "string"
          },
          "metadata": {
            "$id": "#/properties/federatedIdentityProviders/properties/metadata",
            "type": "string"
          }
        }
      }
    }
  }
}
module.exports = schema;