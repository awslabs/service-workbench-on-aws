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

describe('Get workspace-type candidates scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Get workspace-type candidates', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(adminSession2.user);

      await expect(adminSession2.resources.workspaceTypeCandidates.get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();

      await expect(anonymousSession.resources.workspaceTypeCandidates.get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail if user is not admin', async () => {
      const researcherSession = await setup.createResearcherSession();

      await expect(researcherSession.resources.workspaceTypeCandidates.get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    // eslint-disable-next-line jest/no-commented-out-tests
    // it('should return non-empty array if user is admin', async () => {
    //   await expect(adminSession.resources.workspaceTypeCandidates.get()).resolves.not.toHaveLength(0);
    // });
  });
});
