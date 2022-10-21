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

const { runSetup } = require('../../../../support/setup');
const errorCode = require('../../../../support/utils/error-code');

describe('Get user role scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  const adminRole = {
    createdBy: '_system_',
    description: 'Administrator',
    id: 'admin',
    userType: 'INTERNAL',
  };
  const internalGuestRole = {
    createdBy: '_system_',
    description: 'Internal Guest',
    id: 'internal-guest',
    userType: 'INTERNAL',
  };

  const internalResearcherRole = {
    createdBy: '_system_',
    description: 'Internal Researcher',
    id: 'researcher',
    userType: 'INTERNAL',
  };
  const externalGuestRole = {
    createdBy: '_system_',
    description: 'External Guest',
    id: 'guest',
    userType: 'EXTERNAL',
  };

  describe('Getting user roles', () => {

    it.each(['admin', 'researcher', 'guest', 'internal-guest'])('should fail for inactive %p', async role => {
      const currentSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await adminSession.resources.users.deactivateUser(currentSession.user);
      await expect(currentSession.resources.userRoles.get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it.each(['admin', 'researcher', 'guest', 'internal-guest'])('should pass for %p', async role => {
      const currentSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await expect(currentSession.resources.userRoles.get()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining(adminRole),
          expect.objectContaining(internalGuestRole),
          expect.objectContaining(internalResearcherRole),
          expect.objectContaining(externalGuestRole),
        ]),
      );
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.userRoles.get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
