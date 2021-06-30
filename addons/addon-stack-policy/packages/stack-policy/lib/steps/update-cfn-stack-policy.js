/* eslint-disable no-await-in-loop */
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
const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  backendStackName: 'backendStackName',
  enableEgressStore: 'enableEgressStore',
};

const egressStoreStackPolicy = {
  Statement: [
    {
      Effect: 'Allow',
      Action: 'Update:*',
      Principal: '*',
      Resource: '*',
    },
    {
      Effect: 'Deny',
      Action: 'Update:Delete',
      Principal: '*',
      Resource: 'LogicalResourceId/EgressStore*',
    },
  ],
};

class UpdateCfnStackPolicy extends Service {
  constructor() {
    super();
    this.dependency(['aws']);
  }

  async init() {
    await super.init();
    const aws = await this.service('aws');
    this.cfn = new aws.sdk.CloudFormation({ apiVersion: '2010-05-15' });
  }

  async execute() {
    const enableEgressStore = this.settings.get(settingKeys.enableEgressStore);
    if (enableEgressStore.toUpperCase() === 'true') {
      try {
        // fetch the current cloudformation stack policy
        const backendStackName = this.settings.get(settingKeys.backendStackName);
        const currentStackPolicy = await this.cfn.getStackPolicy({ StackName: backendStackName }).promise();
        const currentStackPolicyBody = JSON.parse(currentStackPolicy.StackPolicyBody);
        let isEmptyPolicy = _.isEmpty(currentStackPolicyBody);
        if (!currentStackPolicyBody.Statement) {
          currentStackPolicyBody.Statement = [];
        }
        isEmptyPolicy = isEmptyPolicy || currentStackPolicyBody.Statement.length === 0;

        if (isEmptyPolicy) {
          await this.cfn
            .setStackPolicy({
              StackName: backendStackName,
              StackPolicyBody: JSON.stringify(egressStoreStackPolicy),
            })
            .promise();
        } else if (
          !_.find(currentStackPolicyBody.Statement, {
            Resource: 'LogicalResourceId/EgressStore*',
          })
        ) {
          // compare statements and add target policy in
          const newPolicy = [...currentStackPolicyBody.Statement, egressStoreStackPolicy.Statement[1]];
          await this.cfn
            .setStackPolicy({
              StackName: backendStackName,
              StackPolicyBody: JSON.stringify(newPolicy),
            })
            .promise();
        }
        this.log.info('Finish updating backend stack policy');
      } catch (error) {
        this.log.info({ error });
        throw new Error('Updating CloudFormation Stacks failed. See the previous log message for more details.');
      }
    } else {
      this.log.info('CFN stack policy is not updated');
    }
  }
}

module.exports = UpdateCfnStackPolicy;
