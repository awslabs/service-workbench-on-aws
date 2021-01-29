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

jest.mock('@aws-ee/environment-type-mgmt-services/lib/environment-type/env-type-config-service');
const EnvTypeConfigService = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/env-type-config-service');

jest.mock('@aws-ee/environment-type-mgmt-services/lib/environment-type/env-type-config-authz-service');
const EnvTypeConfigAuthzService = require('@aws-ee/environment-type-mgmt-services/lib/environment-type/env-type-config-authz-service');

jest.mock('../../project/project-service');
const ProjectServiceMock = require('../../project/project-service');

const EnvironmentAuthZService = require('../environment-authz-service.js');

describe('EnvironmentAuthzService', () => {
  let service = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('envTypeConfigService', new EnvTypeConfigService());
    container.register('projectService', new ProjectServiceMock());
    container.register('envTypeConfigAuthzService', new EnvTypeConfigAuthzService());
    container.register('environmentAuthzService', new EnvironmentAuthZService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentAuthzService');
  });

  // Simplify repetitive Jest test cases with test.each here
  const ScGetUpdateDelete = [['get-sc'], ['update-sc'], ['delete-sc']];

  describe('Tests for get-sc, update-sc, and delete-sc actions', () => {
    test.each(ScGetUpdateDelete)(
      'For %p action, the service should return allow response because environment is owned by the requesting researcher',
      async action => {
        // BUILD
        const params = {
          action,
          effect: 'allow', // Effect as other plugins have contributed till now
        };
        const environment = { id: 'sampleEnvId', createdBy: 'sampleUserUid' };
        const args = [environment];
        const requestContext = {
          principalIdentifier: {
            uid: 'sampleUserUid',
          },
          principal: { status: 'active', userRole: 'researcher', isAdmin: false },
        };

        // EXECUTE
        const response = await service.authorize(requestContext, params, ...args);

        // CHECK
        expect(response).toEqual({ effect: 'allow' });
      },
    );

    test.each(ScGetUpdateDelete)(
      'For %p action, the service should return allow response because environment is requested by an admin (non-owner)',
      async action => {
        // BUILD
        const params = {
          action,
          effect: 'allow', // Effect as other plugins have contributed till now
        };
        const environment = { id: 'sampleEnvId', createdBy: 'sampleUserUid' };
        const args = [environment];
        const requestContext = {
          principalIdentifier: {
            uid: 'sampleUserUid',
          },
          principal: { status: 'active', userRole: 'researcher', isAdmin: false },
        };

        // EXECUTE
        const response = await service.authorize(requestContext, params, ...args);

        // CHECK
        expect(response).toEqual({ effect: 'allow' });
      },
    );

    test.each(ScGetUpdateDelete)(
      'For %p action, the service should return deny response because non-owner, non-admin user is requesting the environment',
      async action => {
        // BUILD
        const params = {
          action,
          effect: 'allow', // Effect as other plugins have contributed till now
        };
        const environment = { id: 'sampleEnvId', createdBy: 'sampleUserUid' };
        const args = [environment];
        const requestContext = {
          principalIdentifier: {
            uid: 'anotherUserUid',
          },
          principal: { status: 'active', userRole: 'researcher' },
        };

        try {
          await service.authorize(requestContext, params, ...args);
        } catch (err) {
          expect(err).toEqual({
            effect: 'deny',
            message: `Cannot perform the specified action "${action}". Only admins or current user can.`,
          });
        }
      },
    );

    test.each(ScGetUpdateDelete)(
      'For %p action, the service should return deny response because inactive admin user is requesting the environment',
      async action => {
        // BUILD
        const params = {
          action,
          effect: 'allow', // Effect as other plugins have contributed till now
        };
        const environment = { id: 'sampleEnvId', createdBy: 'sampleUserUid' };
        const args = [environment];
        const requestContext = {
          principalIdentifier: {
            uid: 'anotherUserUid',
          },
          principal: { status: 'inactive', userRole: 'admin' },
        };

        try {
          await service.authorize(requestContext, params, ...args);
        } catch (err) {
          expect(err).toEqual({
            effect: 'deny',
            message: `Cannot perform the specified action "${action}". Only admins or current user can.`,
          });
        }
      },
    );

    test.each(ScGetUpdateDelete)(
      'For %p action, the service should return deny response because inactive owner is requesting the environment',
      async action => {
        // BUILD
        const params = {
          action,
          effect: 'allow', // Effect as other plugins have contributed till now
        };
        const environment = { id: 'sampleEnvId', createdBy: 'sampleUserUid' };
        const args = [environment];
        const requestContext = {
          principalIdentifier: {
            uid: 'sampleUserUid',
          },
          principal: { status: 'inactive', userRole: 'researcher' },
        };

        try {
          await service.authorize(requestContext, params, ...args);
        } catch (err) {
          expect(err).toEqual({
            effect: 'deny',
            message: `Cannot perform the specified action "${action}". Only admins or current user can.`,
          });
        }
      },
    );

    test.each(ScGetUpdateDelete)(
      'For %p action, the service should return deny response if some other plugin denied for any reason',
      async action => {
        // BUILD
        const params = {
          action,
          effect: 'deny', // Effect as other plugins have contributed till now
        };
        const environment = { id: 'sampleEnvId', createdBy: 'sampleUserUid' };
        const args = [environment];
        const requestContext = {
          principalIdentifier: {
            uid: 'sampleUserUid',
          },
          principal: { status: 'active', userRole: 'researcher' },
        };

        try {
          await service.authorize(requestContext, params, ...args);
        } catch (err) {
          expect(err).toEqual({
            effect: 'deny',
          });
        }
      },
    );

    test.each(ScGetUpdateDelete)(
      'For %p action, the service should return deny response if user role is not acceptable',
      async action => {
        // BUILD
        const params = {
          action,
          effect: 'allow', // Effect as other plugins have contributed till now
        };
        const environment = { id: 'sampleEnvId', createdBy: 'sampleUserUid' };
        const args = [environment];
        const requestContext = {
          principalIdentifier: {
            uid: 'sampleUserUid',
          },
          principal: { status: 'active', userRole: 'guest' },
        };

        try {
          await service.authorize(requestContext, params, ...args);
        } catch (err) {
          expect(err).toEqual({
            effect: 'deny',
          });
        }
      },
    );
  });
});
