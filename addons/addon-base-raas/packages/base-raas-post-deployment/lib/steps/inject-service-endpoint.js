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

/* eslint-disable no-await-in-loop */
const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

class InjectServiceEndpoint extends Service {
  constructor() {
    // eslint-disable-line no-useless-constructor
    super();
    this.dependency(['aws']);
  }

  async init() {
    await super.init();
  }

  async execute() {
    const [aws] = await this.service(['aws']);

    const lambdaName = this.settings.get('workflowLambdaName');
    const backendStackName = this.settings.get('backendStackName');
    const cfn = new aws.sdk.CloudFormation();
    const backendStack = await cfn.describeStacks({ StackName: backendStackName }).promise();
    const serviceEndpoint = _.find(backendStack.Stacks[0].Outputs, { OutputKey: 'ServiceEndpoint' }).OutputValue;

    const lambda = new aws.sdk.Lambda();
    const workflowLambda = await lambda.getFunction({ FunctionName: lambdaName }).promise();
    const existingEnvironmentsVariables = workflowLambda.Configuration.Environment.Variables;
    existingEnvironmentsVariables.APP_API_ENDPOINT = serviceEndpoint;
    const updateParams = {
      FunctionName: lambdaName,
      Environment: {
        Variables: existingEnvironmentsVariables,
      },
    };
    await lambda.updateFunctionConfiguration(updateParams).promise();
    this.log.info(`Created APP_API_ENDPOINT:${serviceEndpoint} as a parameter to ${lambdaName}`);
  }
}

module.exports = InjectServiceEndpoint;
