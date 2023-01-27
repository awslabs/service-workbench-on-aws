const { nonHtmlRegex } = require('@amzn/base-services/lib/helpers/constants');

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
    accountName: {
      type: 'string',
      pattern: nonHtmlRegex,
    },
    accountEmail: {
      type: 'string',
    },
    masterRoleArn: {
      type: 'string',
    },
    externalId: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    appStreamFleetDesiredInstances: {
      type: 'string',
    },
    appStreamIdleDisconnectTimeoutSeconds: {
      type: 'string',
    },
    appStreamDisconnectTimeoutSeconds: {
      type: 'string',
    },
    appStreamMaxUserDurationSeconds: {
      type: 'string',
    },
    appStreamImageName: {
      type: 'string',
    },
    appStreamInstanceType: {
      type: 'string',
    },
    appStreamFleetType: {
      type: 'string',
    },
  },
  required: ['accountName', 'accountEmail', 'masterRoleArn', 'externalId'],
};
module.exports = schema;
