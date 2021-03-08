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

describe('Update authentication config scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Update authentication config', () => {
    it('should fail if user is not an admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      const requestBody = researcherSession.resources.authentication.configs().defaults();

      await expect(researcherSession.resources.authentication.configs().update(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to update auth provider config with invalid providerConfigId', async () => {
      const admin2Session = await setup.createAdminSession();
      const requestBody = admin2Session.resources.authentication.configs().defaults();

      await expect(admin2Session.resources.authentication.configs().update(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail if body is empty', async () => {
      const admin2Session = await setup.createAdminSession();
      const requestBody = {};

      await expect(admin2Session.resources.authentication.configs().update(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail if user is inactive', async () => {
      const admin2Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin2Session.user);
      const requestBody = admin2Session.resources.authentication.configs().defaults();

      await expect(admin2Session.resources.authentication.configs().update(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if internal guest attempts to update auth config', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const requestBody = guestSession.resources.authentication.configs().defaults();

      await expect(guestSession.resources.authentication.configs().update(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if external guest attempts to update auth config', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const requestBody = guestSession.resources.authentication.configs().defaults();

      await expect(guestSession.resources.authentication.configs().update(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const requestBody = anonymousSession.resources.authentication.configs().defaults();

      await expect(anonymousSession.resources.authentication.configs().update(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
