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

describe('Reachability of data source account scenarios', () => {
  let setup;
  let adminSession;
  let accountId;
  let requestBody;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    accountId = setup.gen.accountId();
    await adminSession.resources.dataSources.accounts.create({ id: accountId });
    requestBody = { id: accountId, type: 'dsAccount' };
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Triggering reachability of a data source account', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();

      await expect(anonymousSession.resources.dataSources.accounts.reach(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.dataSources.accounts.reach(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      await expect(guestSession.resources.dataSources.accounts.reach(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });

      await expect(guestSession.resources.dataSources.accounts.reach(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();

      await expect(researcherSession.resources.dataSources.accounts.reach(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return status of pending for admin', async () => {
      const admin2Session = await setup.createAdminSession();

      await expect(admin2Session.resources.dataSources.accounts.reach(requestBody)).resolves.toMatchObject({
        id: accountId,
        status: 'pending',
      });
    });
  });
});
