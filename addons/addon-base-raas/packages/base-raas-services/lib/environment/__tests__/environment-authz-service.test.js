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

// Mocked dependencies
jest.mock('../../project/project-service');
const ProjectServiceMock = require('../../project/project-service');

const EnvironmentAuthZService = require('../environment-authz-service.js');

describe('EnvironmentService', () => {
  let service = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    // container.register('envTypeConfigService', new EnvTypeConfigService());
    container.register('projectService', new ProjectServiceMock());
    // container.register('envTypeConfigAuthzService', new EnvTypeConfigAuthzService());
    container.register('environmentAuthzService', new EnvironmentAuthZService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentAuthzService');
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
