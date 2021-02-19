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

describe('Update index scenarios', () => {
  let setup;
  let adminSession;
  let defaultProject;
  let defaultIndex;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    defaultProject = await adminSession.resources.projects.mustFind(setup.gen.defaultProjectId());
    defaultIndex = await adminSession.resources.indexes.mustFind(defaultProject.indexId);
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Updating an index', () => {
    it('should fail when non-admin user is trying to update index', async () => {
      const testIndexId = setup.gen.string({ prefix: `update-index-test-non-admin` });
      const newIndex = await adminSession.resources.indexes.create({
        id: testIndexId,
        awsAccountId: defaultIndex.awsAccountId,
      });

      const researcherSession = await setup.createResearcherSession({ projectId: [testIndexId] });
      const updateBody = { rev: newIndex.rev, description: setup.gen.description(), id: testIndexId };

      await expect(researcherSession.resources.indexes.index(testIndexId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should pass when admin is trying to update index', async () => {
      const testIndexId = setup.gen.string({ prefix: `update-index-test-admin` });
      const newIndex = await adminSession.resources.indexes.create({
        id: testIndexId,
        awsAccountId: defaultIndex.awsAccountId,
      });

      const description = setup.gen.description();
      const adminSession2 = await setup.createAdminSession({ projectId: [testIndexId] });
      const updateBody = { rev: newIndex.rev, description, id: testIndexId, indexId: defaultProject.indexId };

      await expect(adminSession2.resources.indexes.index(testIndexId).update(updateBody)).resolves.toMatchObject({
        id: testIndexId,
        description,
      });
    });

    it('should fail for anonymous user', async () => {
      const projectId = setup.gen.string({ prefix: `update-index-test-non-admin` });
      const newIndex = await adminSession.resources.indexes.create({ id: projectId, indexId: defaultProject.indexId });

      const updateBody = { rev: newIndex.rev, description: setup.gen.description() };

      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.indexes.index(projectId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
