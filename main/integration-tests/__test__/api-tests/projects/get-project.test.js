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

describe('Get project scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting a project', () => {
    it('should fail if user is inactive', async () => {
      const researcherSession = await setup.createResearcherSession();
      const projectId = setup.gen.string({ prefix: `inactive-user-get-proj-test` });

      await adminSession.resources.users.deactivateUser(researcherSession.user);
      await expect(researcherSession.resources.projects.project(projectId).get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    // it('should fail if user is not assigned to project', async () => {
    //   // User not assigned to any projects
    //   const researcherSession = await setup.createResearcherSession({ projectId: [] });
    //   await expect(
    //     researcherSession.resources.projects.project(setup.gen.defaultProjectId()).get(),
    //   ).rejects.toMatchObject({
    //     code: errorCode.http.code.notFound,
    //   });
    // });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.projects.project(setup.gen.defaultProjectId()).get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
