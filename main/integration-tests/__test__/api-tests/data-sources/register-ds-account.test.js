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

describe('Register data source account scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Registering a data source account', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();

      await expect(anonymousSession.resources.dataSources.accounts.create()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.dataSources.accounts.create()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      await expect(guestSession.resources.dataSources.accounts.create()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(guestSession.resources.dataSources.accounts.create()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();

      await expect(researcherSession.resources.dataSources.accounts.create()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return account registration information if admin', async () => {
      const admin2Session = await setup.createAdminSession();
      const accountId = setup.gen.accountId();

      await expect(admin2Session.resources.dataSources.accounts.create({ id: accountId })).resolves.toHaveProperty(
        'id',
        accountId,
      );
    });
  });
});
