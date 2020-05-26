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

const _ = require('lodash');
const aws = require('aws-sdk');

const STACK_FAIL = [
  'CREATE_FAILED',
  'ROLLBACK_FAILED',
  'DELETE_FAILED',
  'UPDATE_ROLLBACK_FAILED',
  'ROLLBACK_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
];
const STACK_SUCCESS = ['CREATE_COMPLETE', 'DELETE_COMPLETE', 'UPDATE_COMPLETE'];

export default class CfnService {
  constructor(accessKeyId, secretAccessKey, region = 'us-east-1') {
    if (accessKeyId) {
      this.cfn = new aws.CloudFormation({
        accessKeyId,
        secretAccessKey,
        region,
        sslEnabled: true,
      });
    } else {
      this.cfn = new aws.CloudFormation({
        sslEnabled: true,
      });
    }
  }

  isDone(status) {
    return STACK_FAIL.includes(status) || STACK_SUCCESS.includes(status);
  }

  static async validateCredentials(accessKeyId, secretAccessKey) {
    const sts = new aws.STS({
      accessKeyId,
      secretAccessKey,
      sslEnabled: true,
    });

    return sts.getCallerIdentity().promise();
  }

  async describeStack(stackName) {
    const params = { StackName: stackName };

    try {
      const response = await this.cfn.describeStacks(params).promise();
      const stack = _.get(response, 'Stacks[0]');
      const status = _.get(stack, 'StackStatus', 'Unknown');
      const statusReason = _.get(stack, 'StackStatusReason', 'Unknown');
      const outputs = _.get(stack, 'Outputs', []);
      const outputsNormalized = _.map(outputs, item => ({
        key: item.OutputKey,
        value: item.OutputValue,
        description: item.Description,
        exportName: item.ExportName,
      }));

      return {
        status,
        statusReason,
        isDone: this.isDone(status),
        isFailed: STACK_FAIL.includes(status),
        outputs: outputsNormalized,
      };
    } catch (e) {
      throw new Error(`${e.code}: ${e.message}`);
    }
  }

  async createStack(stackName, cfnParams, templateUrl, description = '') {
    const input = {
      StackName: stackName,
      Parameters: cfnParams,
      Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      TemplateURL: templateUrl,
      Tags: [
        {
          Key: 'Description',
          Value: description,
        },
      ],
    };

    return this.cfn.createStack(input).promise();
  }

  async deleteStack(stackName) {
    const input = {
      StackName: stackName,
    };

    const response = await this.cfn.deleteStack(input).promise();

    return response;
  }
}
