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

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/iam/iam-service');
const IamServiceMock = require('@aws-ee/base-services/lib/iam/iam-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../../study/study-service');
const StudyServiceMock = require('../../study/study-service');

jest.mock('../../study/study-permission-service');
const StudyPermissionServiceMock = require('../../study/study-permission-service');

jest.mock('../service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('../service-catalog/environment-sc-service');

const EnvironmentMountService = require('../environment-mount-service.js');

describe('EnvironmentMountService', () => {
  let service = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('environmentMountService', new EnvironmentMountService());
    container.register('studyService', new StudyServiceMock());
    container.register('studyPermissionService', new StudyPermissionServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('iamService', new IamServiceMock());
    container.register('settings', new SettingsServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentMountService');
  });

  describe('Update paths', () => {
    it('should call nothing if all are admin changes', async () => {
      const params = {
        id: 'my-environment',
        operation: 'start',
      };

      try {
        await service.changeWorkspaceRunState({}, params);
      } catch (err) {
        // TODO
      }
    });
  });
});
