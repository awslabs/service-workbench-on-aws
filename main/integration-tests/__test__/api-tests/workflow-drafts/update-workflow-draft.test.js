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

describe('Update workflow drafts scenarios', () => {
  let setup;
  let adminSession;

  // Creates an update request object that is ready to be used for the update operation
  const createUpdateRequest = async () => {
    const workflowId = setup.gen.string({ prefix: 'update-wf-draft-test' });
    const title = setup.gen.string({ prefix: 'Title updated update-wf-draft-test' });
    const draft = await adminSession.resources.workflows.drafts().create({ workflowId });

    return {
      id: draft.id,
      rev: draft.rev,
      workflowId,
      workflow: {
        id: draft.workflow.id,
        v: draft.workflow.v,
        rev: draft.workflow.rev,
        selectedSteps: [],
        title,
        workflowTemplateId: draft.workflow.workflowTemplateId,
        workflowTemplateVer: draft.workflow.workflowTemplateVer,
      },
    };
  };

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Updating workflow drafts', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const updateRequest = await createUpdateRequest();

      await expect(
        anonymousSession.resources.workflows
          .drafts()
          .draft(updateRequest.id)
          .update(updateRequest),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const updateRequest = await createUpdateRequest();

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.workflows
          .drafts()
          .draft(updateRequest.id)
          .update(updateRequest),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const updateRequest = await createUpdateRequest();

      await expect(
        guestSession.resources.workflows
          .drafts()
          .draft(updateRequest.id)
          .update(updateRequest),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const updateRequest = await createUpdateRequest();

      await expect(
        guestSession.resources.workflows
          .drafts()
          .draft(updateRequest.id)
          .update(updateRequest),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const updateRequest = await createUpdateRequest();

      await expect(
        researcherSession.resources.workflows
          .drafts()
          .draft(updateRequest.id)
          .update(updateRequest),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should update the workflow drafts for admin', async () => {
      const updateRequest = await createUpdateRequest();

      await expect(
        adminSession.resources.workflows
          .drafts()
          .draft(updateRequest.id)
          .update(updateRequest),
      ).resolves.toHaveProperty('workflow.title', updateRequest.workflow.title);
    });
  });
});
