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

describe('Get workflow versions scenarios', () => {
  let setup;
  let adminSession;
  let workflow;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    const workflowId = setup.gen.string({ prefix: 'get-wf-version-test' });
    workflow = await adminSession.resources.workflows.versions(workflowId).create();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting workflow versions', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();

      // To test returning all versions of a specific workflow
      await expect(anonymousSession.resources.workflows.versions(workflow.id).get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });

      // To test returning the latest version of a specific workflow
      await expect(anonymousSession.resources.workflows.versions(workflow.id).latest()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });

      // To test returning a specific version of a specific workflow
      await expect(
        anonymousSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      // To test returning all versions of a specific workflow
      await expect(researcherSession.resources.workflows.versions(workflow.id).get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });

      // To test returning the latest version of a specific workflow
      await expect(researcherSession.resources.workflows.versions(workflow.id).latest()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });

      // To test returning a specific version of a specific workflow
      await expect(
        researcherSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      // To test returning all versions of a specific workflow
      await expect(guestSession.resources.workflows.versions(workflow.id).get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning the latest version of a specific workflow
      await expect(guestSession.resources.workflows.versions(workflow.id).latest()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning a specific version of a specific workflow
      await expect(
        guestSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });

      // To test returning all versions of a specific workflow
      await expect(guestSession.resources.workflows.versions(workflow.id).get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning the latest version of a specific workflow
      await expect(guestSession.resources.workflows.versions(workflow.id).latest()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning a specific version of a specific workflow
      await expect(
        guestSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();

      // To test returning all versions of a specific workflow
      await expect(researcherSession.resources.workflows.versions(workflow.id).get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning the latest version of a specific workflow
      await expect(researcherSession.resources.workflows.versions(workflow.id).latest()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning a specific version of a specific workflow
      await expect(
        researcherSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return workflow versions for admin', async () => {
      // To test returning all versions of a specific workflow
      await expect(adminSession.resources.workflows.versions(workflow.id).get()).resolves.toMatchObject(
        expect.arrayContaining([expect.objectContaining({ id: workflow.id, title: workflow.title, v: workflow.v })]),
      );

      // To test returning the latest version of a specific workflow
      await expect(adminSession.resources.workflows.versions(workflow.id).latest()).resolves.toMatchObject({
        id: workflow.id,
        title: workflow.title,
        v: workflow.v,
      });

      // To test returning a specific version of a specific workflow
      await expect(
        adminSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .get(),
      ).resolves.toMatchObject({ id: workflow.id, title: workflow.title, v: workflow.v });
    });
  });
});
