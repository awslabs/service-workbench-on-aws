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

class CloudFormation {
  constructor({ aws, sdk }) {
    this.aws = aws;
    this.sdk = sdk;
  }

  async getStackOutputValue(stackName, keyName) {
    const output = await this.getStackOutput(stackName);
    return output[keyName];
  }

  async getStackOutput(stackName) {
    const response = await this.sdk.describeStacks({ StackName: stackName }).promise();
    const output = _.get(response, 'Stacks[0].Outputs', []);
    const result = {};

    _.forEach(output, ({ OutputKey, OutputValue }) => {
      result[OutputKey] = OutputValue;
    });

    return result;
  }
}

// The aws javascript sdk client name
CloudFormation.clientName = 'CloudFormation';

module.exports = CloudFormation;
