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

describe('Delete workflow template draft scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Deleting a workflow template draft', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const draft = await adminSession.resources.workflowTemplates.drafts().create();

      await expect(
        anonymousSession.resources.workflowTemplates
          .drafts()
          .draft(draft.id)
          .delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });

      // Even though the delete operation is rejected, we want to double check that there is no bug where the code
      // is actually deleting the entry. Therefore, we need to get the draft again to verify that it still exists
      await expect(adminSession.resources.workflowTemplates.drafts().find(draft.id)).resolves.toHaveProperty(
        'id',
        draft.id,
      );
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const draft = await adminSession.resources.workflowTemplates.drafts().create();

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.workflowTemplates
          .drafts()
          .draft(draft.id)
          .delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });

      // Even though the delete operation is rejected, we want to double check that there is no bug where the code
      // is actually deleting the entry. Therefore, we need to get the draft again to verify that it still exists
      await expect(adminSession.resources.workflowTemplates.drafts().find(draft.id)).resolves.toHaveProperty(
        'id',
        draft.id,
      );
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const draft = await adminSession.resources.workflowTemplates.drafts().create();

      await expect(
        guestSession.resources.workflowTemplates
          .drafts()
          .draft(draft.id)
          .delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // Even though the delete operation is rejected, we want to double check that there is no bug where the code
      // is actually deleting the entry. Therefore, we need to get the draft again to verify that it still exists
      await expect(adminSession.resources.workflowTemplates.drafts().find(draft.id)).resolves.toHaveProperty(
        'id',
        draft.id,
      );
    });

    it('should fail if external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const draft = await adminSession.resources.workflowTemplates.drafts().create();

      await expect(
        guestSession.resources.workflowTemplates
          .drafts()
          .draft(draft.id)
          .delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // Even though the delete operation is rejected, we want to double check that there is no bug where the code
      // is actually deleting the entry. Therefore, we need to get the draft again to verify that it still exists
      await expect(adminSession.resources.workflowTemplates.drafts().find(draft.id)).resolves.toHaveProperty(
        'id',
        draft.id,
      );
    });

    it('should fail if researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const draft = await adminSession.resources.workflowTemplates.drafts().create();

      await expect(
        researcherSession.resources.workflowTemplates
          .drafts()
          .draft(draft.id)
          .delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // Even though the delete operation is rejected, we want to double check that there is no bug where the code
      // is actually deleting the entry. Therefore, we need to get the draft again to verify that it still exists
      await expect(adminSession.resources.workflowTemplates.drafts().find(draft.id)).resolves.toHaveProperty(
        'id',
        draft.id,
      );
    });

    it('should delete the workflow template draft if admin', async () => {
      const draft = await adminSession.resources.workflowTemplates.drafts().create();

      await expect(
        adminSession.resources.workflowTemplates
          .drafts()
          .draft(draft.id)
          .delete(),
      ).resolves.toBeDefined();

      // We should not be getting the draft again
      await expect(adminSession.resources.workflowTemplates.drafts().find(draft.id)).resolves.not.toBeDefined();
    });
  });
});
