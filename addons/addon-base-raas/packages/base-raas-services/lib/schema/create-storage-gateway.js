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
    vpcId: {
      type: 'string',
      pattern: '^vpc-[a-f0-9]{8,17}$',
    },
    subnetId: {
      type: 'string',
      pattern: '^subnet-[a-f0-9]{8,17}$',
    },
    ec2Instance: {
      type: 'string',
    },
    elasticIP: {
      type: 'string',
      pattern: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$',
    },
    securityGroup: {
      type: 'string',
    },
    ec2RoleARN: {
      type: 'string',
      minLength: 10,
    },
    volumeIds: {
      type: 'array',
      items: [
        {
          type: 'string',
          minLength: 1,
        },
      ],
    },
    cfnStackId: {
      type: 'string',
      description: 'Cloudformation StackId for bringing up Network Infrastructure for this Storage Gateway instance',
    },
  },
  required: ['vpcId', 'subnetId', 'ec2Instance', 'elasticIP', 'securityGroup', 'ec2RoleARN', 'volumeIds'],
};
module.exports = schema;
