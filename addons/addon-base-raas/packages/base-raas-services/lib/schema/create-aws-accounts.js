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
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: idRegex
    },
    rev: {
      type: 'number',
      minimum: 0,
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      pattern: nonHtmlRegex
    },
    description: {
      type: 'string',
      maxLength: 2048,
    },
    accountId: {
      type: 'string',
      pattern: '^[0-9]{12}$',
    },
    roleArn: {
      type: 'string',
      minLength: 10,
    },
    xAccEnvMgmtRoleArn: {
      type: 'string',
      minLength: 10,
    },
    externalId: {
      type: 'string',
      minLength: 1,
    },
    vpcId: {
      type: 'string',
      pattern: '^vpc-[a-f0-9]{8,17}$',
    },
    subnetId: {
      type: 'string',
      pattern: '^subnet-[a-f0-9]{8,17}$',
    },
    publicRouteTableId: {
      type: 'string',
    },
    encryptionKeyArn: {
      type: 'string',
      pattern: '^arn:aws:kms:.*$',
    },
    appStreamStackName: {
      type: 'string',
      minLength: 10,
    },
    appStreamFleetName: {
      type: 'string',
      minLength: 10,
    },
    appStreamSecurityGroupId: {
      type: 'string',
      pattern: '^sg-[a-f0-9]{17}$',
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
    route53HostedZone: {
      type: 'string',
    },
    onboardStatusRoleArn: {
      type: 'string',
      minLength: 10,
      pattern: '^arn:aws:iam::.*$',
    },
    cfnStackName: {
      type: 'string',
      maxLength: 2048,
    },
    cfnStackId: {
      type: 'string',
      maxLength: 255,
      pattern: '^arn:aws:cloudformation:.*$',
    },
    permissionStatus: {
      type: 'string',
    },
  },
  required: ['accountId', 'name'],
};
module.exports = schema;
