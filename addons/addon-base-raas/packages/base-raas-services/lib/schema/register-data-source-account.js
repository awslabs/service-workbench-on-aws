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
const { nonHtmlRegex } = require('@amzn/base-services/lib/helpers/constants');
const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 300,
      pattern: nonHtmlRegex
    },
    description: {
      type: "string",
      maxLength: 2048,
      pattern: nonHtmlRegex
    },
    contactInfo: {
      type: "string",
      maxLength: 2048,
      pattern: nonHtmlRegex
    },
    id: {
      type: "string",
      pattern: "^[0-9]{12}$"
    },
    mainRegion: {
      type: "string",
      enum: [
        "us-west-1",
        "us-west-2",
        "us-east-1",
        "us-east-2",
        "af-south-1",
        "ap-east-1",
        "ap-south-1",
        "ap-northeast-1",
        "ap-northeast-2",
        "ap-northeast-3",
        "ap-southeast-1",
        "ap-southeast-2",
        "ca-central-1",
        "cn-north-1",
        "cn-northwest-1",
        "eu-central-1",
        "eu-north-1",
        "eu-south-1",
        "eu-west-1",
        "eu-west-2",
        "eu-west-3",
        "me-south-1",
        "sa-east-1",
        "us-gov-east-1",
        "us-gov-west-1"
      ]
    }
  },
  required: ["name", "id", "mainRegion"]
}
module.exports = schema;