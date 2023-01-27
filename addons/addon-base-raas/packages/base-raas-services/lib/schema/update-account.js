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
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: '^[A-Za-z0-9-_]+$',
    },
    stackId: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
    },
    cfnInfo: {
      type: 'object',
      additionalProperties: false,
      properties: {
        vpcId: {
          type: 'string',
          pattern: '^vpc-[a-f0-9]{8,17}$',
        },
        subnetId: {
          type: 'string',
          pattern: '^subnet-[a-f0-9]{8,17}$',
        },
        crossAccountExecutionRoleArn: {
          type: 'string',
          pattern: '^arn:aws:iam::.*$',
        },
        crossAccountEnvMgmtRoleArn: {
          type: 'string',
          pattern: '^arn:aws:iam::.*$',
        },
        stackId: {
          type: 'string',
        },
        encryptionKeyArn: {
          type: 'string',
          pattern: '^arn:aws:kms:.*$',
        },
      },
    },
    status: {
      type: 'string',
      maxLength: 2048,
    },
    name: {
      type: 'string',
      maxLength: 2048,
      pattern: nonHtmlRegex,
    },
  },
  required: ['id'],
};
module.exports = schema;
