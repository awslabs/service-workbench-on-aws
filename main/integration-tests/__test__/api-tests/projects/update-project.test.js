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

describe('Update project scenarios', () => {
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

  describe('Updating a project', () => {
    it('should fail when non-admin user is trying to update project', async () => {
      const testProjectId = setup.gen.string({ prefix: `update-proj-test-non-admin` });
      const newProj = await adminSession.resources.projects.create({
        id: testProjectId,
        indexId: defaultProject.indexId,
      });

      const researcherSession = await setup.createResearcherSession({ projectId: [testProjectId] });
      const updateBody = { rev: newProj.rev, description: setup.gen.description(), id: testProjectId };

      await expect(
        researcherSession.resources.projects.project(testProjectId).update(updateBody),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should pass when admin is trying to update project', async () => {
      const testProjectId = setup.gen.string({ prefix: `update-proj-test-admin` });
      const newProj = await adminSession.resources.projects.create({
        id: testProjectId,
        indexId: defaultProject.indexId,
      });

      const description = setup.gen.description();
      const adminSession2 = await setup.createAdminSession({ projectId: [testProjectId] });
      const updateBody = { rev: newProj.rev, description, id: testProjectId, indexId: defaultProject.indexId };

      await expect(adminSession2.resources.projects.project(testProjectId).update(updateBody)).resolves.toMatchObject({
        id: testProjectId,
        description,
      });
    });

    it('should fail for anonymous user', async () => {
      const projectId = setup.gen.string({ prefix: `update-proj-test-non-admin` });
      const newProj = await adminSession.resources.projects.create({ id: projectId, indexId: defaultProject.indexId });

      const updateBody = { rev: newProj.rev, description: setup.gen.description() };

      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.projects.project(projectId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
