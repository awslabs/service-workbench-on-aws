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

const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const settingKeys = {
  enableEgressStore: 'enableEgressStore',
  backendStackName: 'backendStackName',
};

/* eslint max-classes-per-file: ["error", 2] */
class ValidationError extends Error {
  constructor(code = '', message = '') {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super();
    this.name = 'ValidationError';
    // Custom debugging information
    this.code = code;
    this.message = message;
    this.date = new Date();
  }
}
class ValidateByobStudyService extends Service {
  constructor() {
    super();
    this.dependency(['dataSourceAccountService', 'studyService', 'aws']);
  }

  async validateByobStudy() {
    const [dataSourceAccountService, studyService] = await this.service(['dataSourceAccountService', 'studyService']);

    // try {
    const enableEgressStore = this.settings.getBoolean(settingKeys.enableEgressStore);
    if (!enableEgressStore) {
      this.log.info('Egress feature is not enabled, no need to validate BYOB Study access types.');
      return;
    }
    // check if backendstack exists
    const backendStackDetail = await this.getBackendStack();

    if (backendStackDetail.length > 1) {
      // multiple backend stack found, which is not right, throw error
      throw new Error('Multiple backend stack found');
    } else if (backendStackDetail.length === 1) {
      // proceed if there is existing backend stack
      const requestContext = getSystemRequestContext();
      const accountList = await dataSourceAccountService.list(requestContext);
      const accountIdList = _.map(accountList, 'id');
      /* eslint-disable no-await-in-loop */
      /* eslint-disable no-restricted-syntax */
      for (const accountId of accountIdList) {
        const studyInfoList = await studyService.listStudiesForAccount(requestContext, { accountId });
        this.log.info(studyInfoList);
        _.forEach(studyInfoList, studyInfo => {
          if (studyInfo.accessType !== 'readonly') {
            throw new ValidationError(
              'InvalidAccessTypeFound',
              `Readwrite access type is not supported with egress feature enabled. StudyId: ${studyInfo.id} has readwrite access which is not allowed. Please remove the study: ${studyInfo.id} and redeploy the solution`,
            );
          }
        });
      }
    }
  }

  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }

  async getCfn() {
    const aws = await this.getAWS();
    return new aws.sdk.CloudFormation();
  }

  async getBackendStack() {
    let result = {};
    const backendStackName = this.settings.get(settingKeys.backendStackName);
    const params = {
      StackName: backendStackName,
    };
    try {
      const cfnClient = await this.getCfn();
      result = await cfnClient.describeStacks(params).promise();
    } catch (err) {
      if (err.code === 'ValidationError' && err.statusCode === 400) {
        this.log.info(
          'This is First time deployment, backend stack does not exist yet, no need to validate BYOB Studies',
        );
        return [];
      }
      throw new Error(
        `Error in pre-deployment validate BYOB study, can not describe backend stack: ${backendStackName}, message: ${err.message}`,
      );
    }

    return result.Stacks;
  }

  async execute() {
    return this.validateByobStudy();
  }
}

module.exports = ValidateByobStudyService;
