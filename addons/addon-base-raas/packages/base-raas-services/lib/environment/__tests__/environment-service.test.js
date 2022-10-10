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

const ServicesContainer = require('@amzn/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@amzn/base-services/lib/json-schema-validation-service');

// Mocked dependencies
jest.mock('@amzn/base-services/lib/db-service');
const DbServiceMock = require('@amzn/base-services/lib/db-service');

jest.mock('@amzn/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@amzn/base-services/lib/aws/aws-service');

jest.mock('@amzn/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@amzn/base-services/lib/authorization/authorization-service');

jest.mock('@amzn/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@amzn/base-services/lib/audit/audit-writer-service');

jest.mock('@amzn/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');

jest.mock('../../project/project-service');
const ProjectServiceMock = require('../../project/project-service');

jest.mock('../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');
const WorkflowTriggerServiceMock = require('../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');

jest.mock('../../aws-accounts/aws-accounts-service');
const AwsAccountsServiceMock = require('../../aws-accounts/aws-accounts-service');

jest.mock('../../indexes/indexes-service');
const IndexesServiceMock = require('../../indexes/indexes-service');

jest.mock('../../user/user-service');
const UserServiceMock = require('../../user/user-service');

jest.mock('../../compute/compute-platform-service');
const ComputePlatformServiceMock = require('../../compute/compute-platform-service');

jest.mock('../../compute/compute-price-service');
const ComputePriceServiceMock = require('../../compute/compute-price-service');

jest.mock('../../study/study-permission-service');
const StudyPermissionServiceMock = require('../../study/study-permission-service');

jest.mock('../environment-ami-service');
const EnvironmentAmiServiceMock = require('../environment-ami-service');

jest.mock('../environment-authz-service');
const EnvironmentAuthZServiceMock = require('../environment-authz-service');

jest.mock('../environment-mount-service');
const EnvironmentMountServiceMock = require('../environment-mount-service');

const EnvironmentService = require('../built-in/environment-service');

describe('EnvironmentService', () => {
  let service = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('environmentService', new EnvironmentService());
    container.register('projectService', new ProjectServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('studyPermissionService', new StudyPermissionServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('environmentAmiService', new EnvironmentAmiServiceMock());
    container.register('environmentAuthzService', new EnvironmentAuthZServiceMock());
    container.register('environmentMountService', new EnvironmentMountServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('indexesService', new IndexesServiceMock());
    container.register('computePlatformService', new ComputePlatformServiceMock());
    container.register('computePriceService', new ComputePriceServiceMock());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('workflowTriggerService', new WorkflowTriggerServiceMock());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentService');
  });

  describe('startingCompletedEnv', () => {
    it('should fail to start if status is already "COMPLETED"', async () => {
      const params = {
        id: 'my-environment',
        operation: 'start',
      };

      // Skip authorization
      service.assertAuthorized = jest.fn();
      service.mustFind = jest.fn(() => {
        return { status: 'COMPLETED', projectId: 'project-id', instanceInfo: { type: 'sagemaker' } };
      });

      try {
        await service.changeWorkspaceRunState({}, params);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual(
          'unable to start environment with id "my-environment" - current status "COMPLETED"',
        );
      }
    });
  });
});
