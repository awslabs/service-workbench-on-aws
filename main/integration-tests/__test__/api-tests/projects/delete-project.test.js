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

describe('Delete project scenarios', () => {
  let setup;
  let adminSession;
  let defaultProject;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    defaultProject = setup.defaults.project;
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Deleting a project', () => {
    it('should fail if admin is inactive', async () => {
      const testProjectId = setup.gen.string({ prefix: `delete-proj-test-inactive-admin` });
      const newProj = await adminSession.resources.projects.create({
        id: testProjectId,
        indexId: defaultProject.indexId,
      });

      const admin2Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin2Session.user);

      await expect(admin2Session.resources.projects.project(newProj.id).delete()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if non-admin user is trying to delete project', async () => {
      const testProjectId = setup.gen.string({ prefix: `delete-proj-test-non-admin` });
      const newProj = await adminSession.resources.projects.create({
        id: testProjectId,
        indexId: defaultProject.indexId,
      });

      const researcherSession = await setup.createResearcherSession({ projectId: [testProjectId] });

      await expect(researcherSession.resources.projects.project(newProj.id).delete()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const testProjectId = setup.gen.string({ prefix: `delete-proj-test-anon-user` });
      const newProj = await adminSession.resources.projects.create({
        id: testProjectId,
        indexId: defaultProject.indexId,
      });
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.projects.project(newProj.id).delete()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
