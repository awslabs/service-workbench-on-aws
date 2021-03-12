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

const { runSetup } = require('../../../support/setup');
const errorCode = require('../../../support/utils/error-code');

describe('Get workflows scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting workflows', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.workflows.get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
      await expect(anonymousSession.resources.workflows.latest()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const admin2Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin2Session.user);

      await expect(admin2Session.resources.workflows.get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
      await expect(admin2Session.resources.workflows.latest()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(guestSession.resources.workflows.get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
      await expect(guestSession.resources.workflows.latest()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(guestSession.resources.workflows.get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
      await expect(guestSession.resources.workflows.latest()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(researcherSession.resources.workflows.get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
      await expect(researcherSession.resources.workflows.latest()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return workflows for admin', async () => {
      await expect(adminSession.resources.workflows.get()).resolves.not.toHaveLength(0);
      await expect(adminSession.resources.workflows.latest()).resolves.not.toHaveLength(0);
    });
  });
});
