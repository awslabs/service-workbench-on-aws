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

describe('Get costs scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting costs on dashboard', () => {
    it('should fail if user is inactive', async () => {
      const researcherSession = await setup.createResearcherSession();
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.costs.getIndexCosts()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should pass if user is active', async () => {
      const researcherSession = await setup.createResearcherSession();

      // This will only work if your Cost Explorer service is enabled,
      // and the tags 'Env', 'Proj' anc 'createdBy' are activated in your main account
      const response = await researcherSession.resources.costs.getIndexCosts();
      expect(response[0]).toHaveProperty('cost');
      expect(response[0]).toHaveProperty('startDate');
    });

    it('should fail if internal guest attempts to get costs', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(guestSession.resources.costs.getIndexCosts()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if external guest attempts to get costs', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(guestSession.resources.costs.getIndexCosts()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.costs.getIndexCosts()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
