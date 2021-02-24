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
const UserAuthzService = require('../user-authz-service');
const systemContext = require('../../helpers/system-context');

describe('UserAuthzService', () => {
  let service = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('userAuthzService', new UserAuthzService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('userAuthzService');
  });

  describe('authorizeCreate test', () => {
    it('should allow system to create root user', async () => {
      // BUILD
      const sysContext = systemContext.getSystemRequestContext();

      // OPERATE
      const sysContextTest = await service.authorizeCreate(sysContext, { action: 'test' }, { userType: 'root' });

      // CHECK
      expect(sysContextTest).toMatchObject({
        effect: 'allow',
      });
    });

    it('should not allow Admin to create root user', async () => {
      // BUILD
      const activeAdmin = {
        principal: {
          status: 'active',
          isAdmin: true,
        },
      };

      // OPERATE
      const activeAdminTest = await service.authorizeCreate(activeAdmin, { action: 'test' }, { userType: 'root' });

      // CHECK
      expect(activeAdminTest).toMatchObject({
        effect: 'deny',
        reason: {
          message: 'Cannot perform the specified action "test". Only system can.',
          safe: false,
        },
      });
    });
  });
});
