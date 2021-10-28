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
  isAppStreamEnabled: 'isAppStreamEnabled',
};

const baseAllowStatement = {
  Effect: 'Allow',
  Action: 'Update:*',
  Principal: '*',
  Resource: '*',
};

const egressStoreStatement = {
  Effect: 'Deny',
  Action: 'Update:Delete',
  Principal: '*',
  Resource: 'LogicalResourceId/EgressStore*',
};

const appStreamStatement = {
  Effect: 'Deny',
  Action: 'Update:Delete',
  Principal: '*',
  Resource: 'LogicalResourceId/AppStream*',
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
    const enableEgressStore = this.settings.getBoolean(settingKeys.enableEgressStore);
    const isEgressStoreEnabled = enableEgressStore;
    const isAppStreamEnabled = this.settings.getBoolean(settingKeys.isAppStreamEnabled);

    if (!isEgressStoreEnabled && !isAppStreamEnabled) {
      this.log.info('AppStream and EgressStore disabled. CFN stack policy does not need updates');
      return;
    }

    // When code reaches here, either AppStream or EgressStore is enabled
    try {
      // fetch the current cloudformation stack policy
      const backendStackName = this.settings.get(settingKeys.backendStackName);
      const existingStackPolicy = await this.cfn.getStackPolicy({ StackName: backendStackName }).promise();
      const existingStackPolicyBody = existingStackPolicy.StackPolicyBody;
      let isEmptyPolicy = _.isEmpty(existingStackPolicyBody);
      let finalPolicyBody = {};

      if (!isEmptyPolicy) {
        finalPolicyBody = JSON.parse(existingStackPolicyBody);
      }

      if (!finalPolicyBody.Statement) {
        finalPolicyBody.Statement = [];
      }

      isEmptyPolicy = isEmptyPolicy || finalPolicyBody.Statement.length === 0;

      if (isEmptyPolicy) {
        finalPolicyBody.Statement.push(baseAllowStatement);
        if (isEgressStoreEnabled) finalPolicyBody.Statement.push(egressStoreStatement);
        if (isAppStreamEnabled) finalPolicyBody.Statement.push(appStreamStatement);

        await this.cfn
          .setStackPolicy({
            StackName: backendStackName,
            StackPolicyBody: JSON.stringify(finalPolicyBody),
          })
          .promise();
      } else {
        // If EgressStore was enabled during this installation round
        // and statement corresponding to EgressStore was not found, add it
        if (
          isEgressStoreEnabled &&
          !_.find(finalPolicyBody.Statement, {
            Resource: 'LogicalResourceId/EgressStore*',
          })
        )
          finalPolicyBody.Statement.push(egressStoreStatement);

        // If AppStream was enabled during this installation round
        // and statement corresponding to AppStream was not found, add it
        if (
          isAppStreamEnabled &&
          !_.find(finalPolicyBody.Statement, {
            Resource: 'LogicalResourceId/AppStream*',
          })
        )
          finalPolicyBody.Statement.push(appStreamStatement);

        // Before making the update call, lets check if this is the same as the existing policy
        if (_.isEqual(finalPolicyBody, JSON.parse(existingStackPolicyBody))) {
          this.log.info('Backend stack policy up to date. No changes needed.');
          return;
        }

        await this.cfn
          .setStackPolicy({
            StackName: backendStackName,
            StackPolicyBody: JSON.stringify(finalPolicyBody),
          })
          .promise();
      }
      this.log.info('Finished updating backend stack policy');
    } catch (error) {
      this.log.info({ error });
      throw new Error('Updating CloudFormation Stacks failed. See the previous log message for more details.');
    }
  }
}

module.exports = UpdateCfnStackPolicy;
